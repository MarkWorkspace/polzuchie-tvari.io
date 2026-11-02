# ROLE: Поведение клиентского RESYNC: cooldown, сброс очереди, ровно один FULL
# после запроса и совместимость с PING/input. Не тестирует gameplay и формат кадра.

import asyncio
import types
import zlib

import pytest

import server
from app.api import websocket as ws_module
from app.api.websocket import RESYNC_COOLDOWN_SECONDS, _run_receive_loop, request_resync
from app.engine.systems import snake_pb2


class _ScriptedWebSocket:
    """Feed scripted client messages, then drop the connection."""

    def __init__(self, messages):
        self._messages = list(messages)
        self.sent_text = []

    async def receive_text(self):
        if not self._messages:
            raise RuntimeError("test client disconnected")
        return self._messages.pop(0)

    async def send_text(self, data):
        self.sent_text.append(data)


class _InputWorld:
    def __init__(self):
        self.input_queue = []


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


def _connection():
    return {"queue": asyncio.Queue(maxsize=1), "needs_full_sync": False}


def _decoded_type(item) -> int:
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(zlib.decompress(item[0]))
    return frame.type


async def _drain_receive_loop(websocket, world, connection):
    """Run the infinite receive loop until the scripted socket disconnects."""
    with pytest.raises(RuntimeError):
        await _run_receive_loop("client", websocket, world, connection)


@pytest.mark.asyncio
async def test_resync_requests_full_and_drops_queued_frames():
    connection = _connection()
    connection["queue"].put_nowait((b"stale-delta", set(), False))
    world = _InputWorld()

    await _drain_receive_loop(_ScriptedWebSocket(["RESYNC"]), world, connection)

    assert connection["needs_full_sync"] is True
    # The queued DELTA chain is already broken on the client: the FULL replaces it.
    assert connection["queue"].empty()
    assert world.input_queue == []


@pytest.mark.asyncio
async def test_resync_is_not_forwarded_as_player_input():
    connection = _connection()
    world = _InputWorld()
    websocket = _ScriptedWebSocket(["PING:42", "LEFT_DOWN", "RESYNC", "RIGHT_UP"])

    await _drain_receive_loop(websocket, world, connection)

    assert websocket.sent_text == ["PONG:42"]
    assert world.input_queue == [("client", "LEFT_DOWN"), ("client", "RIGHT_UP")]
    assert connection["needs_full_sync"] is True


def test_repeated_resync_inside_cooldown_is_ignored():
    connection = _connection()

    assert request_resync(connection, now=10.0) is True
    assert connection["needs_full_sync"] is True

    # Simulate the FULL having been built and sent.
    connection["needs_full_sync"] = False

    assert request_resync(connection, now=10.0 + RESYNC_COOLDOWN_SECONDS / 2) is False
    assert connection["needs_full_sync"] is False

    # The window has passed: the client may ask again.
    assert request_resync(connection, now=10.0 + RESYNC_COOLDOWN_SECONDS) is True
    assert connection["needs_full_sync"] is True


@pytest.mark.asyncio
async def test_resync_spam_requests_full_only_once():
    connection = _connection()
    world = _InputWorld()

    await _drain_receive_loop(_ScriptedWebSocket(["RESYNC"] * 10), world, connection)

    # All bursts landed inside one cooldown window, so only the first counted.
    assert connection["resync_epoch"] == 1
    assert connection["needs_full_sync"] is True


@pytest.mark.asyncio
async def test_resync_builds_exactly_one_full_then_resumes_deltas():
    connection = _connection()
    connection["queue"].put_nowait((b"stale-delta", set(), False))
    world = _FrameWorld()

    assert request_resync(connection) is True
    assert connection["queue"].empty()

    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert world.delta_builds == 0
    assert connection["needs_full_sync"] is False
    queued = connection["queue"].get_nowait()
    assert queued[2] is True
    assert _decoded_type(queued) == snake_pb2.GameStateFrame.FrameType.FULL

    # The next tick is a normal DELTA: a single RESYNC never causes a FULL storm.
    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert world.delta_builds == 1
    assert connection["needs_full_sync"] is False


@pytest.mark.asyncio
async def test_resync_during_frame_build_is_not_lost():
    """A RESYNC that lands while process_client awaits must survive."""
    connection = _connection()
    world = _FrameWorld()
    original = world.get_delta_state

    def resync_during_build(*args, **kwargs):
        request_resync(connection)
        return original(*args, **kwargs)

    world.get_delta_state = resync_during_build

    await server.process_client("client", connection, world)

    # The in-flight DELTA is still delivered, but the FULL request is preserved
    # for the next tick instead of being cleared by the build's own bookkeeping.
    assert world.delta_builds == 1
    assert connection["needs_full_sync"] is True

    # The sender drains the slot (FULL coalescing waits for it), then the next
    # tick builds the requested FULL.
    connection["queue"].get_nowait()
    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert connection["needs_full_sync"] is False


def test_resync_command_fits_client_message_limit():
    assert len(ws_module.RESYNC_MESSAGE) <= ws_module.MAX_CLIENT_MESSAGE_LENGTH


@pytest.mark.asyncio
async def test_resync_during_full_build_does_not_request_second_full():
    """A RESYNC that lands while a FULL is being built needs no extra FULL."""
    connection = _connection()
    connection["needs_full_sync"] = True
    world = _FrameWorld()
    original = world.get_delta_state

    def resync_during_build(*args, **kwargs):
        request_resync(connection)
        return original(*args, **kwargs)

    world.get_delta_state = resync_during_build

    await server.process_client("client", connection, world)

    assert world.full_builds == 1
    assert world.delta_builds == 0
    assert connection["needs_full_sync"] is False
    assert (
        _decoded_type(connection["queue"].get_nowait()) == snake_pb2.GameStateFrame.FrameType.FULL
    )
