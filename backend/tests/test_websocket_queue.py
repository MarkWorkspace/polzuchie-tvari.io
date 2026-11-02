# ROLE: Backpressure sender-очереди: статусы QueueStatus при замене FULL/DELTA,
# coalescing FULL у медленного клиента и закрытие websocket при сбое sender.
# Не тестирует protobuf-формат кадра и handshake endpoint.

import asyncio
import logging
import types
import zlib

import pytest

import server
from app.api.websocket import QueueStatus, replace_queued_state, sender_loop
from app.engine.systems import snake_pb2

DELTA_FRAME = (b"delta", set(), False)
FULL_FRAME = (b"full", set(), True)


def _queue(item=None):
    queue = asyncio.Queue(maxsize=1)
    if item is not None:
        queue.put_nowait(item)
    return queue


@pytest.mark.asyncio
async def test_empty_queue_queues_delta():
    queue = _queue()

    status = replace_queued_state(queue, DELTA_FRAME)

    assert status is QueueStatus.QUEUED
    assert queue.qsize() == 1
    assert queue.get_nowait() == DELTA_FRAME


@pytest.mark.asyncio
async def test_empty_queue_queues_full():
    queue = _queue()
    new_full = (b"new-full", set(), True)

    status = replace_queued_state(queue, new_full)

    # QUEUED means "stored, nothing displaced"; the caller still knows it built
    # a FULL from is_full_sync, so this status is unambiguous.
    assert status is QueueStatus.QUEUED
    assert queue.qsize() == 1
    assert queue.get_nowait() == new_full


@pytest.mark.asyncio
async def test_delta_is_dropped_while_full_is_pending():
    queue = _queue(FULL_FRAME)

    status = replace_queued_state(queue, DELTA_FRAME)

    assert status is QueueStatus.DROPPED_DELTA_FULL_PENDING
    assert queue.qsize() == 1
    assert queue.get_nowait() == FULL_FRAME


@pytest.mark.asyncio
async def test_delta_replaces_delta():
    queue = _queue((b"old-delta", set(), False))
    new_delta = (b"new-delta", set(), False)

    status = replace_queued_state(queue, new_delta)

    assert status is QueueStatus.REPLACED_DELTA
    assert queue.qsize() == 1
    assert queue.get_nowait() == new_delta


@pytest.mark.asyncio
async def test_full_replaces_delta():
    queue = _queue(DELTA_FRAME)
    new_full = (b"new-full", set(), True)

    status = replace_queued_state(queue, new_full)

    assert status is QueueStatus.REPLACED_FULL
    assert queue.qsize() == 1
    assert queue.get_nowait() == new_full


@pytest.mark.asyncio
async def test_full_replaces_full_without_growing_queue():
    queue = _queue((b"old-full", set(), True))
    new_full = (b"new-full", set(), True)

    status = replace_queued_state(queue, new_full)

    assert status is QueueStatus.REPLACED_FULL
    assert queue.qsize() == 1
    assert queue.get_nowait() == new_full


class _FrameWorld:
    """Minimal world for process_client: counts FULL/DELTA builds."""

    def __init__(self):
        self.full_builds = 0
        self.delta_builds = 0
        self.food_manager = types.SimpleNamespace(foods={})

    def get_delta_state(
        self,
        client_id,
        is_full=False,
        update_visibility=True,
        return_visibility=False,
        serialize_proto=False,
    ):
        frame = snake_pb2.GameStateFrame()
        if is_full:
            self.full_builds += 1
            frame.type = snake_pb2.GameStateFrame.FrameType.FULL
        else:
            self.delta_builds += 1
            frame.type = snake_pb2.GameStateFrame.FrameType.DELTA
        if serialize_proto:
            data = frame.SerializeToString()
            return (data, set()) if return_visibility else data
        return (frame, set()) if return_visibility else frame


def _decoded_type(item) -> int:
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(zlib.decompress(item[0]))
    return frame.type


@pytest.mark.asyncio
async def test_slow_client_coalesces_full_without_storm():
    queue = _queue((b"pending-full", set(), True))
    connection = {"queue": queue, "needs_full_sync": True}
    world = _FrameWorld()

    # The slot is still occupied: no frame is built at all.
    await server.process_client("client", connection, world)

    assert world.full_builds == 0
    assert connection["needs_full_sync"] is True
    assert queue.qsize() == 1

    # The sender drains the slot: exactly one FULL is built and queued.
    queue.get_nowait()
    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert connection["needs_full_sync"] is False
    pending = queue.get_nowait()
    assert pending[2] is True
    assert _decoded_type(pending) == snake_pb2.GameStateFrame.FrameType.FULL

    # The new FULL stays pending for several ticks: every DELTA is dropped and
    # no second FULL is built, so a slow client cannot trigger a FULL storm.
    queue.put_nowait((b"pending-full", set(), True))
    for _ in range(3):
        await server.process_client("client", connection, world)

    assert world.delta_builds == 3
    assert world.full_builds == 1
    assert connection["needs_full_sync"] is False
    assert queue.qsize() == 1


@pytest.mark.asyncio
async def test_lost_delta_triggers_exactly_one_full_sync():
    queue = _queue((b"old-delta", set(), False))
    connection = {"queue": queue, "needs_full_sync": False}
    world = _FrameWorld()

    # A new DELTA replaces the queued one: the client missed a frame.
    await server.process_client("client", connection, world)

    assert world.delta_builds == 1
    assert world.full_builds == 0
    assert connection["needs_full_sync"] is True
    assert queue.qsize() == 1

    # While the queue is still full the FULL build is coalesced, not repeated.
    await server.process_client("client", connection, world)

    assert world.delta_builds == 1
    assert world.full_builds == 0
    assert connection["needs_full_sync"] is True

    # After the drain exactly one FULL is built; normal deltas resume after it.
    queue.get_nowait()
    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert connection["needs_full_sync"] is False
    assert _decoded_type(queue.get_nowait()) == snake_pb2.GameStateFrame.FrameType.FULL

    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert connection["needs_full_sync"] is False


class _FailingWebSocket:
    def __init__(self):
        self.close_calls = 0
        self.close_code = None
        self.close_reason = None

    async def send_bytes(self, data):
        raise ConnectionError("socket is gone")

    async def close(self, code=None, reason=None):
        self.close_calls += 1
        self.close_code = code
        self.close_reason = reason


class _VisibilityWorld:
    def __init__(self):
        self.visibility = None

    def set_client_visibility(self, client_id, visible_players):
        self.visibility = (client_id, visible_players)


@pytest.mark.asyncio
async def test_sender_failure_logs_closes_and_stops(caplog):
    queue = _queue((b"frame", set(), False))
    websocket = _FailingWebSocket()
    world = _VisibilityWorld()

    with caplog.at_level(logging.ERROR, logger="app.api.websocket"):
        task = asyncio.create_task(sender_loop("client", websocket, queue, world))
        await asyncio.wait_for(task, timeout=1.0)

    assert task.done()
    assert task.cancelled() is False
    assert websocket.close_calls == 1
    assert websocket.close_code == 1011
    assert websocket.close_reason == "Send failed"
    assert world.visibility is None
    assert any(record.levelno >= logging.ERROR for record in caplog.records)
