# ROLE: Регрессии идентичности spectator/player, cookie-auth и очистки после неудачного handshake.
import uuid
from types import SimpleNamespace

import pytest

from app.api import websocket as ws_module
from app.api.session import PLAYER_SESSION_COOKIE, PlayerSession
from app.api.websocket import _validate_client, active_connections, websocket_endpoint
from app.engine.state import World


@pytest.fixture(autouse=True)
def clean_connections():
    ws_module.active_connections.clear()
    ws_module.pending_disconnects.clear()
    yield
    ws_module.active_connections.clear()
    ws_module.pending_disconnects.clear()


def _session(player_id: str) -> PlayerSession:
    return PlayerSession(player_id=player_id, created_at=0.0, last_seen=0.0)


def test_spectator_never_reuses_player_session_id():
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")

    client_id, reconnecting = _validate_client(world, "spectator", _session(player_id))

    assert client_id != player_id
    assert reconnecting is False


def test_query_client_id_cannot_claim_existing_player():
    # _validate_client has no query-id input at all: without a session the
    # caller can only get a brand-new identity.
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")

    client_id, reconnecting = _validate_client(world, "player")

    assert client_id != player_id
    assert reconnecting is False
    assert player_id in world.players


def test_valid_session_reconnects_existing_player():
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")

    client_id, reconnecting = _validate_client(world, "player", _session(player_id))

    assert client_id == player_id
    assert reconnecting is True


def test_valid_session_for_missing_player_keeps_id_without_reconnect():
    world = World()
    player_id = str(uuid.uuid4())

    client_id, reconnecting = _validate_client(world, "player", _session(player_id))

    assert client_id == player_id
    assert reconnecting is False


def test_session_reconnect_takes_over_active_connection():
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")
    active_connections[player_id] = {"websocket": object(), "task": object()}

    client_id, reconnecting = _validate_client(world, "player", _session(player_id))

    assert client_id == player_id
    assert reconnecting is True


class FailingWebSocket:
    def __init__(self, world, cookies=None):
        self.app = SimpleNamespace(state=SimpleNamespace(world=world))
        self.cookies = cookies or {}
        self.closed = False

    async def accept(self):
        return None

    async def send_bytes(self, data):
        raise RuntimeError("handshake send failed")

    async def receive_text(self):
        raise AssertionError("receive loop must not start")

    async def close(self, code=None, reason=None):
        self.closed = True


@pytest.mark.asyncio
async def test_failed_handshake_removes_authenticated_player(monkeypatch):
    world = World()
    player_id = str(uuid.uuid4())
    monkeypatch.setattr(
        ws_module,
        "resolve_session_from_cookies",
        lambda cookies: _session(player_id),
    )
    websocket = FailingWebSocket(world, {PLAYER_SESSION_COOKIE: "opaque"})

    await websocket_endpoint(
        websocket,
        nickname="Ghost",
        skin="#22c55e",
        role="player",
    )

    assert player_id not in world.players
    assert player_id not in active_connections
    assert websocket.closed is True
