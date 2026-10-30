# ROLE: WebSocket endpoint, cookie-based player identity, rate limiting. Не игровая логика.
import asyncio
import contextlib
import logging
import re
import uuid
import zlib
from collections import deque
from fastapi import WebSocket

from app.api.session import PlayerSession, resolve_session_from_cookies


active_connections = {}
pending_disconnects = {}
logger = logging.getLogger(__name__)

MAX_CONNECTIONS = 50
RATE_LIMIT_PER_SECOND = 50
MAX_CLIENT_MESSAGE_LENGTH = 32
VALID_SKINS = frozenset({"zebra", "tiger", "rainbow", "cyberpunk"})
HEX_COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
NICKNAME_MAX_LENGTH = 16


async def sender_loop(client_id, websocket, queue, world):
    try:
        while True:
            item = await queue.get()
            data, visible_players = item[0], item[1]
            await websocket.send_bytes(data)
            world.set_client_visibility(client_id, visible_players)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.debug("Sender loop stopped", exc_info=True)


def replace_queued_state(queue, data_tuple):
    new_is_full = data_tuple[2]
    skipped = False

    if queue.full():
        try:
            current_item = queue._queue[0]
            current_is_full = current_item[2]
            if current_is_full and not new_is_full:
                # Do not replace a full sync with a partial sync
                return False
        except Exception:
            pass

        with contextlib.suppress(asyncio.QueueEmpty):
            queue.get_nowait()
            skipped = True

    with contextlib.suppress(asyncio.QueueFull):
        queue.put_nowait(data_tuple)
    return skipped


def _new_client_id() -> str:
    return str(uuid.uuid4())


def _validate_client(
    world,
    role: str = "player",
    player_session: PlayerSession | None = None,
) -> tuple[str, bool]:
    """Return a safe connection id.

    Only a valid player session cookie can claim an existing player. A
    spectator always gets a fresh identity: reusing a player's id would kick
    the player, leave a ghost snake and make both tabs fight over the same
    active connection.
    """
    if role == "spectator":
        return _new_client_id(), False

    if player_session is None:
        return _new_client_id(), False

    player_id = player_session.player_id
    return player_id, player_id in world.players


def _clean_profile(nickname: str, skin: str) -> tuple[str, str]:
    nickname = nickname.strip()[:NICKNAME_MAX_LENGTH] or "Игрок"
    if skin not in VALID_SKINS and not HEX_COLOR_PATTERN.match(skin):
        skin = "#22c55e"
    return nickname, skin


async def _handle_reconnection(
    client_id: str,
    reconnecting: bool,
    nickname: str,
    skin: str,
    websocket: WebSocket,
    world,
    role: str,
):
    disconnect_task = pending_disconnects.pop(client_id, None)
    if disconnect_task:
        disconnect_task.cancel()

    if reconnecting:
        old_conn = active_connections.pop(client_id, None)
        if old_conn:
            old_conn["task"].cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await old_conn["task"]
            with contextlib.suppress(Exception):
                await old_conn["websocket"].close()

        # Completely reset state for this player upon reconnection
        world.client_visibility[client_id] = set()
        world.reset_player_input(client_id)
        world.input_queue = [item for item in world.input_queue if item[0] != client_id]
        if role == "spectator":
            world.spectators.add(client_id)
        else:
            world.spectators.discard(client_id)
    else:
        if role == "spectator":
            world.spectators.add(client_id)
        else:
            world.spectators.discard(client_id)
            world.add_player(client_id, nickname, skin)


async def _initialize_connection(client_id: str, websocket: WebSocket, world) -> asyncio.Queue:
    full_state_bytes = world.get_full_state(client_id, serialize_proto=True)
    await websocket.send_bytes(zlib.compress(full_state_bytes))

    send_queue = asyncio.Queue(maxsize=1)
    send_task = asyncio.create_task(sender_loop(client_id, websocket, send_queue, world))
    active_connections[client_id] = {
        "websocket": websocket,
        "queue": send_queue,
        "task": send_task,
        "needs_full_sync": False,
    }
    return send_queue


async def _run_receive_loop(client_id: str, websocket: WebSocket, world):
    msg_timestamps = deque()
    while True:
        data = await websocket.receive_text()
        if len(data) > MAX_CLIENT_MESSAGE_LENGTH:
            continue

        now = asyncio.get_running_loop().time()
        while msg_timestamps and msg_timestamps[0] < now - 1.0:
            msg_timestamps.popleft()
        if len(msg_timestamps) >= RATE_LIMIT_PER_SECOND:
            continue
        msg_timestamps.append(now)

        if data.startswith("SCORE:"):
            continue

        if data.startswith("PING:"):
            try:
                await websocket.send_text(f"PONG:{data[5:]}")
            except Exception:
                pass
            continue

        world.input_queue.append((client_id, data))


async def _cleanup_connection(client_id: str, websocket: WebSocket, world):
    conn = active_connections.get(client_id)
    if conn and conn["websocket"] == websocket:
        active_connections.pop(client_id, None)
        conn["task"].cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await conn["task"]

        world.reset_player_input(client_id)

        async def delayed_remove(cid):
            try:
                await asyncio.sleep(3.0)
                world.remove_player(cid)
                pending_disconnects.pop(cid, None)
            except asyncio.CancelledError:
                pass

        pending_disconnects[client_id] = asyncio.create_task(delayed_remove(client_id))


async def websocket_endpoint(
    websocket: WebSocket,
    nickname: str = "Игрок",
    skin: str = "#22c55e",
    client_id: str | None = None,
    role: str = "player",
):
    world = websocket.app.state.world
    if client_id:
        logger.warning(
            "Ignoring deprecated client_id query parameter on WebSocket handshake; "
            "player identity comes from the player session cookie"
        )
    # Spectators never resolve the cookie: they must not reuse a player id nor
    # touch the session's last_seen timestamp.
    player_session = (
        None if role == "spectator" else resolve_session_from_cookies(websocket.cookies)
    )
    client_id, reconnecting = _validate_client(world, role, player_session)
    if len(active_connections) >= MAX_CONNECTIONS and not reconnecting:
        await websocket.close(code=4002, reason="Server full")
        return

    nickname, skin = _clean_profile(nickname, skin)
    await websocket.accept()

    initialized = False
    try:
        await _handle_reconnection(client_id, reconnecting, nickname, skin, websocket, world, role)
        await _initialize_connection(client_id, websocket, world)
        initialized = True
        await _run_receive_loop(client_id, websocket, world)
    except Exception:
        logger.debug("WebSocket session failed", exc_info=True)
    finally:
        await _cleanup_connection(client_id, websocket, world)
        if not initialized:
            # Handshake failed before the connection was registered. Remove
            # the just-created player/spectator so it cannot become a ghost.
            conn = active_connections.pop(client_id, None)
            if conn:
                conn["task"].cancel()
            disconnect_task = pending_disconnects.pop(client_id, None)
            if disconnect_task:
                disconnect_task.cancel()
            world.remove_player(client_id)
            with contextlib.suppress(Exception):
                await websocket.close()
