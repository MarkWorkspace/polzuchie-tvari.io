# ROLE: Тесты Admin API restart-потока. Проверяет Protobuf restart-frame и очистку соединений.

import asyncio
import types
import zlib

import pytest

from app.api.admin import admin_restart_game
from app.api.websocket import active_connections, pending_disconnects
from app.engine.systems import snake_pb2


class FakeTask:
    def __init__(self):
        self.cancelled = False

    def cancel(self):
        self.cancelled = True


class FakeWebSocket:
    def __init__(self):
        self.closed = False
        self.close_code = None
        self.close_reason = None

    async def close(self, code=None, reason=None):
        self.closed = True
        self.close_code = code
        self.close_reason = reason


class FakeWorld:
    def __init__(self):
        self.reset_called = False

    def reset_state(self):
        self.reset_called = True


def _fake_request(world):
    state = types.SimpleNamespace(world=world)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=state))


@pytest.mark.asyncio
async def test_admin_restart_queues_protobuf_restart_frame():
    active_connections.clear()
    pending_disconnects.clear()
    queue = asyncio.Queue(maxsize=1)
    websocket = FakeWebSocket()
    task = FakeTask()
    pending_task = FakeTask()
    world = FakeWorld()

    active_connections["client"] = {"queue": queue, "websocket": websocket, "task": task}
    pending_disconnects["client"] = pending_task

    result = await admin_restart_game(_fake_request(world))
    data, visible_players, is_full = queue.get_nowait()
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(zlib.decompress(data))

    assert result["status"] == "ok"
    assert frame.type == snake_pb2.GameStateFrame.FrameType.SERVER_RESTART
    assert frame.restart_message
    assert visible_players == set()
    assert is_full is True
    assert websocket.closed is True
    assert websocket.close_code == 1012
    assert task.cancelled is True
    assert pending_task.cancelled is True
    assert active_connections == {}
    assert pending_disconnects == {}
    assert world.reset_called is True
