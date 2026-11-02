# ROLE: Late-join FULL parity: initial handshake FULL and resync FULL share one
# writer, carry a valid your_id/foods/seq, and compression runs off the event
# loop. Does not test gameplay or the wire format beyond field presence.

import asyncio
import threading
import zlib

import pytest

import server
from app.api import websocket as ws_module
from app.engine.systems import snake_pb2
from tests.frame_scenario import build_deterministic_world

LATE_ID = "late-joiner"


class _RecordingWebSocket:
    def __init__(self):
        self.sent = []

    async def send_bytes(self, data):
        self.sent.append(data)


def _decode(data):
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(zlib.decompress(data))
    return frame


def _late_join_world():
    world = build_deterministic_world()
    for _ in range(3):
        world.tick()
    world.add_player(LATE_ID, nickname="Late", skin="#22c55e")
    return world


@pytest.mark.asyncio
async def test_late_join_after_tick_receives_complete_full():
    world = _late_join_world()
    websocket = _RecordingWebSocket()

    await ws_module._send_full_state(LATE_ID, websocket, world)

    assert len(websocket.sent) == 1
    frame = _decode(websocket.sent[0])
    assert frame.type == snake_pb2.GameStateFrame.FrameType.FULL
    assert frame.your_id == LATE_ID
    assert frame.frame_seq == world.frame_seq
    assert frame.server_tick == world.server_tick
    assert frame.HasField("server_world")
    assert len(frame.foods) == len(world.food_manager.foods) > 0
    assert set(frame.players) == set(world.players)
    assert frame.players[LATE_ID].length == world.players[LATE_ID].body_len
    # A snapshot must not advance/initialize the client's AoI bookkeeping.
    assert LATE_ID not in world.client_visibility


@pytest.mark.asyncio
async def test_resync_full_matches_initial_full_for_late_joiner():
    world = _late_join_world()
    websocket = _RecordingWebSocket()
    await ws_module._send_full_state(LATE_ID, websocket, world)
    initial = _decode(websocket.sent[0])

    connection = {"queue": asyncio.Queue(maxsize=1), "needs_full_sync": True}
    await server.process_client(LATE_ID, connection, world)
    compressed, _visible_players, is_full = connection["queue"].get_nowait()
    resync = _decode(compressed)

    assert is_full is True
    assert resync.SerializeToString(deterministic=True) == initial.SerializeToString(
        deterministic=True
    )
    assert resync.your_id == initial.your_id == LATE_ID
    assert resync.frame_seq == initial.frame_seq == world.frame_seq
    assert resync.server_tick == initial.server_tick == world.server_tick
    assert len(resync.foods) == len(initial.foods) == len(world.food_manager.foods)
    assert set(resync.players) == set(initial.players) == set(world.players)


@pytest.mark.asyncio
async def test_send_full_state_offloads_compression_to_worker_thread(monkeypatch):
    world = _late_join_world()
    loop_thread = threading.get_ident()
    observed = {}
    real_compress = zlib.compress

    def recording_compress(data, level=1):
        observed["compress_thread"] = threading.get_ident()
        observed["level"] = level
        return real_compress(data, level)

    def recording_get_full_state(client_id, serialize_proto=False):
        observed["snapshot_thread"] = threading.get_ident()
        assert serialize_proto is False
        return real_get_full_state(client_id, serialize_proto=serialize_proto)

    real_get_full_state = world.get_full_state
    world.get_full_state = recording_get_full_state
    monkeypatch.setattr(ws_module.zlib, "compress", recording_compress)

    websocket = _RecordingWebSocket()
    await ws_module._send_full_state(LATE_ID, websocket, world)

    # The state snapshot stays on the loop; only zlib.compress moves to a thread.
    assert observed["snapshot_thread"] == loop_thread
    assert observed["compress_thread"] != loop_thread
    assert observed["level"] == 1
    assert _decode(websocket.sent[0]).your_id == LATE_ID
