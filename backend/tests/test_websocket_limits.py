# ROLE: Security regressions for WebSocket admission: Origin allowlist, per-IP
# handshake token bucket and per-role connection caps. Not gameplay tests.

import asyncio
import contextlib
import types

import pytest

from app.api import websocket as ws_module
from app.api.session import PlayerSession
from app.api.websocket import active_connections, websocket_endpoint
from app.engine.state import World


class FakeWebSocket:
    """Minimal WebSocket double that records admission close codes."""

    def __init__(self, world, *, headers=None, host="203.0.113.10", cookies=None):
        self.app = types.SimpleNamespace(state=types.SimpleNamespace(world=world))
        self.headers = headers or {}
        self.client = types.SimpleNamespace(host=host) if host is not None else None
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
        raise RuntimeError("test client disconnected")

    async def close(self, code=None, reason=None):
        self.closed = True
        self.close_code = code
        self.close_reason = reason


class GatedAdmissionWebSocket(FakeWebSocket):
    """Blocks accept/send/receive to control handshake interleavings."""

    def __init__(self, world):
        super().__init__(world)
        self.accept_started = asyncio.Event()
        self.release_accept = asyncio.Event()
        self.send_started = asyncio.Event()
        self.release_send = asyncio.Event()
        self.receive_started = asyncio.Event()
        self.release_receive = asyncio.Event()

    async def accept(self):
        self.accepted = True
        self.accept_started.set()
        await self.release_accept.wait()

    async def send_bytes(self, data):
        self.send_started.set()
        await self.release_send.wait()

    async def receive_text(self):
        self.receive_started.set()
        await self.release_receive.wait()
        raise RuntimeError("test client disconnected")


@pytest.fixture(autouse=True)
def clean_admission_state():
    ws_module.reset_admission_state()
    yield
    ws_module.reset_admission_state()


def _session(player_id: str) -> PlayerSession:
    return PlayerSession(player_id=player_id, created_at=0.0, last_seen=0.0)


def _stub_active(role: str, count: int) -> None:
    for index in range(count):
        active_connections[f"{role}-{index}"] = {"role": role}


@pytest.mark.asyncio
async def test_allowed_origin_registers_player(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://LOCALHOST:5173/")
    world = World()
    websocket = FakeWebSocket(world, headers={"origin": "http://localhost:5173"})

    await websocket_endpoint(websocket, role="player")

    assert websocket.accepted is True
    assert websocket.close_code is None
    assert len(world.players) == 1
    assert world.spectators == set()
    assert ws_module._pending_role_connections["player"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("origin", ["http://evil.example", "null", "https://localhost:5173"])
async def test_disallowed_origin_is_closed_without_state(monkeypatch, origin):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    world = World()
    websocket = FakeWebSocket(world, headers={"origin": origin})

    await websocket_endpoint(websocket, role="spectator")

    # accept() + close(1008): a pre-accept close would surface as HTTP 403.
    assert websocket.accepted is True
    assert websocket.close_code == 1008
    assert websocket.close_reason == "Origin not allowed"
    assert world.players == {}
    assert world.spectators == set()
    assert active_connections == {}


@pytest.mark.asyncio
async def test_denied_origin_consumes_handshake_bucket(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    monkeypatch.setenv("WS_HANDSHAKE_RATE_LIMIT", "1")
    monkeypatch.setenv("WS_HANDSHAKE_WINDOW_SECONDS", "60")
    world = World()

    denied = FakeWebSocket(world, headers={"origin": "http://evil.example"})
    await websocket_endpoint(denied, role="spectator")
    assert denied.close_code == 1008

    # Rate limiting runs first, so the denied handshake already used the only
    # slot in the window even though no world state was touched.
    allowed = FakeWebSocket(world, headers={"origin": "http://localhost:5173"})
    await websocket_endpoint(allowed, role="spectator")
    assert allowed.accepted is True
    assert allowed.close_code == 4029
    assert world.spectators == set()


@pytest.mark.asyncio
async def test_missing_origin_is_allowed(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    world = World()
    websocket = FakeWebSocket(world)

    await websocket_endpoint(websocket, role="player")

    assert websocket.accepted is True
    assert websocket.close_code is None
    assert len(world.players) == 1


def test_allowed_origins_normalizes_exact_entries(monkeypatch):
    monkeypatch.setenv("ALLOWED_ORIGINS", " HTTP://LocalHost:5173/ , ,")

    assert ws_module.allowed_origins() == ("http://localhost:5173",)
    assert ws_module.is_origin_allowed("http://localhost:5173") is True
    assert ws_module.is_origin_allowed("http://localhost:5173/") is True
    assert ws_module.is_origin_allowed("http://localhost:5173.evil.example") is False


def test_origin_defaults_follow_environment(monkeypatch):
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    assert ws_module.allowed_origins() == ws_module.DEV_ALLOWED_ORIGINS

    monkeypatch.setenv("ENVIRONMENT", "production")
    assert ws_module.allowed_origins() == ws_module.PRODUCTION_ALLOWED_ORIGINS


@pytest.mark.asyncio
async def test_per_ip_handshake_limit_rejects_third_attempt(monkeypatch):
    monkeypatch.setenv("WS_HANDSHAKE_RATE_LIMIT", "2")
    monkeypatch.setenv("WS_HANDSHAKE_WINDOW_SECONDS", "60")
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "0")
    world = World()

    first = FakeWebSocket(world, host="203.0.113.7")
    second = FakeWebSocket(world, host="203.0.113.7")
    await websocket_endpoint(first, role="player")
    await websocket_endpoint(second, role="player")
    assert first.close_code is None
    assert second.close_code is None

    third = FakeWebSocket(world, host="203.0.113.7")
    await websocket_endpoint(third, role="player")
    assert third.accepted is True
    assert third.close_code == 4029
    assert third.close_reason == "Too many connection attempts"

    other = FakeWebSocket(world, host="203.0.113.8")
    await websocket_endpoint(other, role="player")
    assert other.close_code is None


@pytest.mark.asyncio
async def test_x_real_ip_is_used_only_when_proxy_headers_are_trusted(monkeypatch):
    monkeypatch.setenv("WS_HANDSHAKE_RATE_LIMIT", "1")
    monkeypatch.setenv("WS_HANDSHAKE_WINDOW_SECONDS", "60")
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    world = World()

    first = FakeWebSocket(world, headers={"x-real-ip": "198.51.100.1"})
    second = FakeWebSocket(world, headers={"x-real-ip": "198.51.100.2"})
    await websocket_endpoint(first, role="player")
    await websocket_endpoint(second, role="player")
    assert first.close_code is None
    assert second.close_code is None

    repeated = FakeWebSocket(world, headers={"x-real-ip": "198.51.100.1"})
    await websocket_endpoint(repeated, role="player")
    assert repeated.close_code == 4029

    ws_module._handshake_attempts.clear()
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "0")

    untrusted_first = FakeWebSocket(world, headers={"x-real-ip": "198.51.100.3"})
    untrusted_second = FakeWebSocket(world, headers={"x-real-ip": "198.51.100.4"})
    await websocket_endpoint(untrusted_first, role="player")
    await websocket_endpoint(untrusted_second, role="player")
    assert untrusted_first.close_code is None
    # Headers are ignored, so both share the socket-peer bucket.
    assert untrusted_second.close_code == 4029


@pytest.mark.asyncio
async def test_spectator_cap_rejects_extra_spectators(monkeypatch):
    monkeypatch.setenv("MAX_SPECTATOR_CONNECTIONS", "3")
    world = World()
    _stub_active("spectator", 3)
    websocket = FakeWebSocket(world)

    await websocket_endpoint(websocket, role="spectator")

    assert websocket.accepted is True
    assert websocket.close_code == 4003
    assert websocket.close_reason == "Spectator limit reached"
    assert world.spectators == set()
    assert len(active_connections) == 3
    assert ws_module._pending_role_connections["spectator"] == 0


@pytest.mark.asyncio
async def test_player_cap_rejection_does_not_touch_world(monkeypatch):
    monkeypatch.setenv("MAX_PLAYER_CONNECTIONS", "1")
    world = World()
    world.add_player("existing", "Existing", "#22c55e")
    existing = world.players["existing"]
    food_count = len(world.food_manager.foods)
    active_connections["existing"] = {"role": "player"}
    websocket = FakeWebSocket(world)

    await websocket_endpoint(websocket, role="player")

    assert websocket.accepted is True
    assert websocket.close_code == 4002
    assert websocket.close_reason == "Server full"
    # The rejected handshake never reaches _handle_reconnection: the existing
    # player object is untouched and no death/food events are produced.
    assert world.players == {"existing": existing}
    assert world.kill_events == []
    assert len(world.food_manager.foods) == food_count
    assert len(active_connections) == 1
    assert ws_module._pending_role_connections["player"] == 0


@pytest.mark.asyncio
async def test_spectator_flood_does_not_consume_player_slots(monkeypatch):
    monkeypatch.setenv("MAX_SPECTATOR_CONNECTIONS", "3")
    monkeypatch.setenv("MAX_PLAYER_CONNECTIONS", "1")
    world = World()
    _stub_active("spectator", 3)
    websocket = FakeWebSocket(world)

    await websocket_endpoint(websocket, role="player")

    assert websocket.accepted is True
    assert websocket.close_code is None
    assert len(world.players) == 1
    assert ws_module._pending_role_connections["player"] == 0


@pytest.mark.asyncio
async def test_player_takeover_is_not_blocked_by_cap(monkeypatch):
    monkeypatch.setenv("MAX_PLAYER_CONNECTIONS", "1")
    monkeypatch.setattr(ws_module, "resolve_session_from_cookies", lambda _cookies: _session("p"))
    world = World()
    world.add_player("p", "Old", "#22c55e")
    old_websocket = FakeWebSocket(world)
    active_connections["p"] = {
        "websocket": old_websocket,
        "queue": asyncio.Queue(maxsize=1),
        "task": None,
        "needs_full_sync": False,
        "epoch": 1,
        "role": "player",
    }
    websocket = FakeWebSocket(world, cookies={"player_session": "opaque"})

    await websocket_endpoint(websocket, role="player", nickname="New")

    assert websocket.accepted is True
    assert websocket.close_code is None
    # Takeover keeps the player and only replaces its active connection.
    assert "p" in world.players
    assert active_connections.get("p") is None
    assert old_websocket.closed is True


@pytest.mark.asyncio
async def test_role_reservation_rejects_concurrent_handshake(monkeypatch):
    monkeypatch.setenv("MAX_SPECTATOR_CONNECTIONS", "1")
    world = World()
    first = GatedAdmissionWebSocket(world)
    second = FakeWebSocket(world)
    first_task = asyncio.create_task(websocket_endpoint(first, role="spectator"))
    second_task = None
    try:
        # First handshake reserves the only slot and blocks in accept().
        await asyncio.wait_for(first.accept_started.wait(), 1.0)
        assert ws_module._pending_role_connections["spectator"] == 1
        assert world.spectators == set()
        assert active_connections == {}

        # Second handshake is rejected by the pending reservation before
        # accept/world mutation, even though no active connection exists yet.
        second_task = asyncio.create_task(websocket_endpoint(second, role="spectator"))
        await asyncio.wait_for(second_task, 1.0)
        assert second.accepted is True
        assert second.close_code == 4003
        assert second.close_reason == "Spectator limit reached"
        assert world.spectators == set()
        assert world.players == {}
        assert world.kill_events == []
        assert active_connections == {}
        assert ws_module._pending_role_connections["spectator"] == 1

        # Releasing accept lets the first handshake claim its slot.
        first.release_accept.set()
        await asyncio.wait_for(first.send_started.wait(), 1.0)
        assert ws_module._pending_role_connections["spectator"] == 0
        assert len(active_connections) == 1
        first_id = next(iter(active_connections))
        assert world.spectators == {first_id}

        first.release_send.set()
        await asyncio.wait_for(first.receive_started.wait(), 1.0)
        assert len(active_connections) == 1
        assert ws_module._pending_role_connections["spectator"] == 0

        first.release_receive.set()
        await asyncio.wait_for(first_task, 1.0)
        assert ws_module._pending_role_connections["spectator"] == 0
        assert world.kill_events == []
    finally:
        for task in (first_task, second_task):
            if task is not None and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
