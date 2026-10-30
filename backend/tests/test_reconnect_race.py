# ROLE: Regression tests for reconnect epochs and the delayed-remove/restart
# lifecycle race. Does not test gameplay, serialization or session cookies.

import asyncio
import contextlib
import types

import pytest

from app.api import admin as admin_module
from app.api import websocket as ws_module
from app.api.admin import admin_restart_game
from app.api.session import PlayerSession
from app.api.websocket import (
    _claim_connection,
    _cleanup_connection,
    _handle_reconnection,
    _reject_after_restart,
    active_connections,
    pending_disconnects,
    websocket_endpoint,
)
from app.engine.state import World


class FakeWebSocket:
    def __init__(self, world=None, cookies=None):
        self.app = types.SimpleNamespace(state=types.SimpleNamespace(world=world))
        self.cookies = cookies or {}
        self.accepted = False
        self.closed = False
        self.close_code = None
        self.close_reason = None

    async def accept(self):
        self.accepted = True

    async def send_bytes(self, data):
        return None

    async def receive_text(self):
        raise AssertionError("receive loop must not start")

    async def close(self, code=None, reason=None):
        self.closed = True
        self.close_code = code
        self.close_reason = reason


class SlowCancelTask:
    """Awaitable task double that keeps cleanup paused after cancel()."""

    def __init__(self):
        self.cancelled = False
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    def cancel(self):
        self.cancelled = True

    def __await__(self):
        async def _wait():
            self.started.set()
            await self.release.wait()

        return _wait().__await__()


class GatedWebSocket(FakeWebSocket):
    """Blocks the FULL-state send so a restart/reconnect can interleave."""

    def __init__(self, world):
        super().__init__(world)
        self.send_started = asyncio.Event()
        self.release_send = asyncio.Event()

    async def send_bytes(self, data):
        self.send_started.set()
        await self.release_send.wait()


class GatedAcceptWebSocket(FakeWebSocket):
    """Blocks accept() and receive_text() to control handshake interleavings."""

    def __init__(self, world):
        super().__init__(world)
        self.accept_started = asyncio.Event()
        self.release_accept = asyncio.Event()
        self.receive_started = asyncio.Event()
        self.release_receive = asyncio.Event()

    async def accept(self):
        self.accepted = True
        self.accept_started.set()
        await self.release_accept.wait()

    async def receive_text(self):
        self.receive_started.set()
        await self.release_receive.wait()
        raise RuntimeError("test client disconnected")


class BlockingReceiveWebSocket(FakeWebSocket):
    def __init__(self, world):
        super().__init__(world)
        self.receive_started = asyncio.Event()
        self.release_receive = asyncio.Event()

    async def receive_text(self):
        self.receive_started.set()
        await self.release_receive.wait()
        raise RuntimeError("test client disconnected")


def _fake_request(world):
    state = types.SimpleNamespace(world=world)
    return types.SimpleNamespace(app=types.SimpleNamespace(state=state))


def _session(player_id: str) -> PlayerSession:
    return PlayerSession(player_id=player_id, created_at=0.0, last_seen=0.0)


async def _cancel(task):
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


def _connection(world, epoch, task=None):
    return {
        "websocket": FakeWebSocket(world),
        "queue": asyncio.Queue(maxsize=1),
        "task": task or asyncio.create_task(asyncio.sleep(3600)),
        "needs_full_sync": False,
        "epoch": epoch,
    }


@pytest.mark.asyncio
async def test_connection_epoch_advances_on_reconnect():
    world = World()
    first = _claim_connection("p", FakeWebSocket(world))
    second = _claim_connection("p", FakeWebSocket(world))

    assert second["epoch"] > first["epoch"]
    assert active_connections["p"] is second
    active_connections.pop("p", None)


@pytest.mark.asyncio
async def test_cleanup_accepts_legacy_connection_without_epoch():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    connection = {
        "websocket": FakeWebSocket(world),
        "queue": asyncio.Queue(maxsize=1),
        "task": asyncio.create_task(asyncio.sleep(3600)),
    }
    active_connections["p"] = connection

    await _cleanup_connection("p", connection, world)

    assert "p" not in active_connections
    assert "p" in pending_disconnects
    await _cancel(pending_disconnects.pop("p"))


@pytest.mark.asyncio
async def test_cleanup_does_not_schedule_delayed_remove_after_reconnect():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    slow_task = SlowCancelTask()
    old_connection = _connection(world, epoch=1, task=slow_task)
    new_connection = _connection(world, epoch=2)
    active_connections["p"] = old_connection

    cleanup = asyncio.create_task(_cleanup_connection("p", old_connection, world))
    await slow_task.started.wait()

    # New session registers while the old cleanup is awaiting its sender task.
    active_connections["p"] = new_connection
    slow_task.release.set()
    await cleanup

    assert "p" not in pending_disconnects
    assert "p" in world.players
    assert active_connections["p"] is new_connection
    await _cancel(new_connection["task"])


@pytest.mark.asyncio
async def test_delayed_remove_does_not_kill_new_session(monkeypatch):
    monkeypatch.setattr(ws_module, "RECONNECT_GRACE_SECONDS", 0.01)
    world = World()
    world.add_player("p", "Player", "#22c55e")
    new_connection = _connection(world, epoch=2)
    active_connections["p"] = new_connection

    removal = asyncio.create_task(ws_module.delayed_remove("p", 1, world))
    pending_disconnects["p"] = removal
    await removal

    assert "p" in world.players
    assert "p" not in pending_disconnects
    await _cancel(new_connection["task"])


@pytest.mark.asyncio
async def test_pending_disconnect_cancelled_on_reconnect():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    pending = asyncio.create_task(asyncio.sleep(3600))
    pending_disconnects["p"] = pending

    applied = await _handle_reconnection(
        "p",
        True,
        "Player",
        "#22c55e",
        FakeWebSocket(world),
        world,
        "player",
        world.restart_epoch,
    )

    assert applied is True
    assert "p" not in pending_disconnects
    await asyncio.sleep(0)
    assert pending.cancelled() is True
    assert "p" in world.players


@pytest.mark.asyncio
async def test_reconnect_recreates_player_removed_during_accept_window(monkeypatch):
    monkeypatch.setattr(ws_module, "RECONNECT_GRACE_SECONDS", 0.01)
    monkeypatch.setattr(ws_module, "resolve_session_from_cookies", lambda _cookies: _session("p"))
    world = World()
    world.add_player("p", "Old", "#22c55e")
    websocket = GatedAcceptWebSocket(world)
    endpoint = asyncio.create_task(websocket_endpoint(websocket, role="player", nickname="New"))

    try:
        await websocket.accept_started.wait()
        # _validate_client already saw the player, but delayed_remove now wins
        # the grace race while the handshake is blocked in accept().
        removal = asyncio.create_task(ws_module.delayed_remove("p", 0, world))
        pending_disconnects["p"] = removal
        await removal
        assert "p" not in world.players

        websocket.release_accept.set()
        await websocket.receive_started.wait()

        assert "p" in world.players
        assert world.players["p"].nickname == "New"
        assert active_connections["p"]["websocket"] is websocket

        websocket.release_receive.set()
        await endpoint
    finally:
        if not endpoint.done():
            endpoint.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await endpoint

    if "p" in pending_disconnects:
        await _cancel(pending_disconnects.pop("p"))


@pytest.mark.asyncio
async def test_reject_after_restart_keeps_newer_session():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    slow_task = SlowCancelTask()
    old_connection = _connection(world, epoch=1, task=slow_task)
    new_connection = _connection(world, epoch=2)
    active_connections["p"] = old_connection

    rejection = asyncio.create_task(_reject_after_restart("p", old_connection, world))
    await slow_task.started.wait()

    # A newer session claims the id while the old sender is being stopped.
    active_connections["p"] = new_connection
    slow_task.release.set()
    await rejection

    assert world.players["p"].nickname == "Player"
    assert active_connections["p"] is new_connection
    await _cancel(new_connection["task"])


@pytest.mark.asyncio
async def test_restart_does_not_leave_ghost_player():
    world = World()
    world.add_player("p", "Player", "#22c55e")
    websocket = FakeWebSocket(world)
    sender = asyncio.create_task(asyncio.sleep(3600))
    pending = asyncio.create_task(asyncio.sleep(3600))
    active_connections["p"] = {
        "websocket": websocket,
        "queue": asyncio.Queue(maxsize=1),
        "task": sender,
        "needs_full_sync": False,
        "epoch": 1,
    }
    pending_disconnects["p"] = pending

    result = await admin_restart_game(_fake_request(world))

    assert result["status"] == "ok"
    assert world.players == {}
    assert active_connections == {}
    assert pending_disconnects == {}
    assert world.draining is False
    assert websocket.closed is True
    assert websocket.close_code == 1012
    assert sender.cancelled() is True
    assert pending.cancelled() is True


@pytest.mark.asyncio
async def test_connection_rejected_while_draining():
    world = World()
    world.draining = True
    websocket = FakeWebSocket(world)

    await websocket_endpoint(websocket, role="player")

    assert websocket.accepted is True
    assert websocket.closed is True
    assert websocket.close_code == 1012
    assert world.players == {}
    assert active_connections == {}


@pytest.mark.asyncio
async def test_restart_rejects_handshake_during_drain(monkeypatch):
    world = World()
    observed = {}

    async def queue_message(_message):
        observed["draining"] = world.draining
        websocket = FakeWebSocket(world)
        await websocket_endpoint(websocket, role="player")
        observed["close_code"] = websocket.close_code
        observed["players"] = dict(world.players)

    monkeypatch.setattr(admin_module, "_queue_restart_message", queue_message)

    await admin_restart_game(_fake_request(world))

    assert observed == {"draining": True, "close_code": 1012, "players": {}}
    assert world.draining is False


@pytest.mark.asyncio
async def test_in_flight_handshake_is_closed_by_restart():
    world = World()
    websocket = GatedWebSocket(world)
    endpoint = asyncio.create_task(websocket_endpoint(websocket, role="player"))

    try:
        await asyncio.wait_for(websocket.send_started.wait(), timeout=1.0)
        epoch_before = world.restart_epoch
        await admin_restart_game(_fake_request(world))
        assert world.restart_epoch == epoch_before + 1

        websocket.release_send.set()
        await asyncio.wait_for(endpoint, timeout=1.0)
    finally:
        if not endpoint.done():
            endpoint.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await endpoint

    assert websocket.close_code == 1012
    assert world.players == {}
    assert active_connections == {}
    assert pending_disconnects == {}


@pytest.mark.asyncio
async def test_handshake_blocked_in_accept_does_not_mutate_restarted_world(monkeypatch):
    monkeypatch.setattr(ws_module, "resolve_session_from_cookies", lambda _cookies: _session("p"))
    world = World()
    world.add_player("p", "Old", "#22c55e")
    websocket = GatedAcceptWebSocket(world)
    endpoint = asyncio.create_task(websocket_endpoint(websocket, role="player"))

    try:
        await websocket.accept_started.wait()
        await admin_restart_game(_fake_request(world))
        assert world.players == {}

        websocket.release_accept.set()
        await asyncio.wait_for(endpoint, timeout=1.0)
    finally:
        if not endpoint.done():
            endpoint.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await endpoint

    assert websocket.close_code == 1012
    assert world.players == {}
    assert world.kill_events == []
    assert active_connections == {}
    assert pending_disconnects == {}


@pytest.mark.asyncio
async def test_newer_session_survives_restart_during_full_send(monkeypatch):
    monkeypatch.setattr(ws_module, "resolve_session_from_cookies", lambda _cookies: _session("p"))
    world = World()
    world.add_player("p", "Old", "#22c55e")

    old_websocket = GatedWebSocket(world)
    old_endpoint = asyncio.create_task(
        websocket_endpoint(old_websocket, role="player", nickname="Old")
    )
    new_endpoint = None
    try:
        # A has claimed the active slot and is blocked sending FULL.
        await asyncio.wait_for(old_websocket.send_started.wait(), timeout=1.0)
        await admin_restart_game(_fake_request(world))
        assert "p" not in world.players

        # B registers into the freshly reset world while A is still blocked.
        new_websocket = BlockingReceiveWebSocket(world)
        new_endpoint = asyncio.create_task(
            websocket_endpoint(new_websocket, role="player", nickname="New")
        )
        await asyncio.wait_for(new_websocket.receive_started.wait(), timeout=1.0)

        new_connection = active_connections["p"]
        assert world.players["p"].nickname == "New"
        assert new_connection["websocket"] is new_websocket
        assert new_connection["task"] is not None

        # Releasing A must not overwrite B or remove B's snake.
        old_websocket.release_send.set()
        await asyncio.wait_for(old_endpoint, timeout=1.0)

        assert old_websocket.close_code == 1012
        assert active_connections == {"p": new_connection}
        assert world.players["p"].nickname == "New"

        new_websocket.release_receive.set()
        await asyncio.wait_for(new_endpoint, timeout=1.0)
    finally:
        for task in (old_endpoint, new_endpoint):
            if task is not None and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    if "p" in pending_disconnects:
        await _cancel(pending_disconnects.pop("p"))


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["player", "spectator"])
async def test_delayed_remove_removes_disconnected_identity(role, monkeypatch):
    monkeypatch.setattr(ws_module, "RECONNECT_GRACE_SECONDS", 0.01)
    world = World()
    if role == "player":
        world.add_player("p", "Player", "#22c55e")
    else:
        world.spectators.add("p")

    removal = asyncio.create_task(ws_module.delayed_remove("p", 0, world))
    pending_disconnects["p"] = removal
    await removal

    assert "p" not in world.players
    assert "p" not in world.spectators
    assert "p" not in pending_disconnects


@pytest.mark.asyncio
async def test_superseded_pending_timer_is_noop(monkeypatch):
    monkeypatch.setattr(ws_module, "RECONNECT_GRACE_SECONDS", 0.01)
    world = World()
    world.add_player("p", "Player", "#22c55e")

    stale = asyncio.create_task(ws_module.delayed_remove("p", 1, world))
    pending_disconnects["p"] = stale
    newer = asyncio.create_task(asyncio.sleep(3600))
    pending_disconnects["p"] = newer

    await stale

    assert "p" in world.players
    await _cancel(pending_disconnects.pop("p"))
