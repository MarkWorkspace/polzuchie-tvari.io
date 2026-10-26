# ROLE: Регрессии идентичности spectator/player и очистки после неудачного handshake.
import uuid

import pytest

from app.api import websocket as ws_module
from app.api.websocket import _validate_client, active_connections, websocket_endpoint
from app.engine.state import World
from types import SimpleNamespace


@pytest.fixture(autouse=True)
def clean_connections():
    ws_module.active_connections.clear()
    ws_module.pending_disconnects.clear()
    yield
    ws_module.active_connections.clear()
    ws_module.pending_disconnects.clear()


def test_spectator_never_reuses_player_id():
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")

    client_id, reconnecting = _validate_client(player_id, world, "spectator")

    assert client_id != player_id
    assert reconnecting is False


def test_player_reconnects_with_own_id():
    world = World()
    player_id = str(uuid.uuid4())
    world.add_player(player_id, "Player", "#22c55e")

    client_id, reconnecting = _validate_client(player_id, world, "player")

    assert client_id == player_id
    assert reconnecting is True


def test_player_id_used_by_another_connection_gets_replaced():
    world = World()
    occupied_id = str(uuid.uuid4())
    active_connections[occupied_id] = {"websocket": object(), "task": object()}

    client_id, reconnecting = _validate_client(occupied_id, world, "player")

    assert client_id != occupied_id
    assert reconnecting is False


class FailingWebSocket:
    def __init__(self, world):
        self.app = SimpleNamespace(state=SimpleNamespace(world=world))
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
async def test_failed_handshake_removes_player():
    world = World()
    client_id = str(uuid.uuid4())
    websocket = FailingWebSocket(world)

    await websocket_endpoint(
        websocket,
        nickname="Ghost",
        skin="#22c55e",
        client_id=client_id,
        role="player",
    )

    assert client_id not in world.players
    assert client_id not in active_connections
    assert websocket.closed is True
