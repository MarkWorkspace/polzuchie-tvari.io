# ROLE: Тесты Admin API restart-потока. Проверяет Protobuf restart-frame,
# очистку/ожидание соединений и draining-флаг. Не тестирует reconnect-гонки.

import asyncio
import types
import zlib

import pytest

from app.api import admin as admin_module
from app.api.admin import admin_restart_game
from app.api.websocket import active_connections, pending_disconnects
from app.engine.systems import snake_pb2


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
        self.draining = False
        self.draining_during_reset = None

    def reset_state(self):
        self.reset_called = True
        self.draining_during_reset = self.draining


def _fake_request(world):
    state = types.SimpleNamespace(world=world)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=state))


@pytest.mark.asyncio
async def test_admin_restart_queues_protobuf_restart_frame():
    active_connections.clear()
    pending_disconnects.clear()
    queue = asyncio.Queue(maxsize=1)
    websocket = FakeWebSocket()
    task = asyncio.create_task(asyncio.sleep(3600))
    pending_task = asyncio.create_task(asyncio.sleep(3600))
    world = FakeWorld()

    active_connections["client"] = {
        "queue": queue,
        "websocket": websocket,
        "task": task,
        "epoch": 1,
    }
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
    assert task.cancelled() is True
    assert pending_task.cancelled() is True
    assert active_connections == {}
    assert pending_disconnects == {}
    assert world.reset_called is True
    assert world.draining_during_reset is True
    assert world.draining is False


@pytest.mark.asyncio
async def test_admin_restart_clears_draining_on_failure(monkeypatch):
    active_connections.clear()
    pending_disconnects.clear()
    world = FakeWorld()

    async def fail(_message):
        raise RuntimeError("restart aborted")

    monkeypatch.setattr(admin_module, "_queue_restart_message", fail)

    with pytest.raises(RuntimeError, match="restart aborted"):
        await admin_restart_game(_fake_request(world))

    assert world.draining is False
    assert world.reset_called is False
