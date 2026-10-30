# ROLE: WebSocket endpoint, cookie-based player identity, connection epochs,
# reconnect grace, draining admission and rate limiting. Не игровая логика.
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
# Time a disconnected player keeps its snake for a fast reconnect.
RECONNECT_GRACE_SECONDS = 3.0

_connection_epoch = 0


def _next_connection_epoch() -> int:
    global _connection_epoch
    _connection_epoch += 1
    return _connection_epoch


def _cancel_pending_disconnect(client_id: str) -> None:
    task = pending_disconnects.pop(client_id, None)
    if task is not None:
        task.cancel()


def _lifecycle_changed(world, restart_epoch) -> bool:
    """True when a handshake started before a drain/restart completed.

    ``restart_epoch`` is captured by the endpoint before any await. A restart
    resets the world (and increments the epoch), so an in-flight handshake must
    not register a connection into the freshly reset world.
    """
    return getattr(world, "draining", False) or (
        getattr(world, "restart_epoch", 0) != restart_epoch
    )


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
    restart_epoch: int = 0,
) -> bool:
    """Apply player/spectator takeover or creation after accept().

    Returns False when a restart started while waiting for the old connection
    to stop. In that case no world state was mutated and the caller only has to
    close the socket.
    """
    _cancel_pending_disconnect(client_id)

    if reconnecting:
        old_conn = active_connections.pop(client_id, None)
        if old_conn:
            task = old_conn.get("task")
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
            with contextlib.suppress(Exception):
                await old_conn["websocket"].close()

        if _lifecycle_changed(world, restart_epoch):
            return False

        # The delayed removal can win the race while the handshake is blocked
        # in accept(): _validate_client already saw the player, but it is gone
        # now. Recreate it instead of leaving a live socket without a snake.
        reconnecting = client_id in world.players

        if reconnecting:
            # Completely reset state for this player upon reconnection
            world.client_visibility[client_id] = set()
            world.reset_player_input(client_id)
            world.input_queue = [item for item in world.input_queue if item[0] != client_id]
            if role == "spectator":
                world.spectators.add(client_id)
            else:
                world.spectators.discard(client_id)
            return True

    if _lifecycle_changed(world, restart_epoch):
        return False

    if role == "spectator":
        world.spectators.add(client_id)
    else:
        world.spectators.discard(client_id)
        world.add_player(client_id, nickname, skin)
    return True


def _claim_connection(client_id: str, websocket: WebSocket) -> dict:
    """Reserve the active slot before the FULL state is sent.

    A newer handshake for the same player id can take the slot over while the
    previous FULL send is still blocked. The stale handshake must then abort
    without registering its sender or touching the newer session's player.
    """
    connection = {
        "websocket": websocket,
        "queue": asyncio.Queue(maxsize=1),
        "task": None,
        "needs_full_sync": False,
        "epoch": _next_connection_epoch(),
    }
    active_connections[client_id] = connection
    return connection


async def _send_full_state(client_id: str, websocket: WebSocket, world) -> None:
    full_state_bytes = world.get_full_state(client_id, serialize_proto=True)
    await websocket.send_bytes(zlib.compress(full_state_bytes))


def _start_sender(client_id: str, connection: dict, world) -> None:
    connection["task"] = asyncio.create_task(
        sender_loop(client_id, connection["websocket"], connection["queue"], world)
    )


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


async def delayed_remove(client_id: str, epoch: int | None, world) -> None:
    """Remove a disconnected player after the reconnect grace period.

    ``epoch`` identifies the connection that scheduled the removal. If any
    connection is registered for ``client_id`` when the timer fires, a newer
    session (or the same one) owns the id and the player must survive. The
    pending-task identity check also makes a superseded timer a no-op.
    """
    try:
        await asyncio.sleep(RECONNECT_GRACE_SECONDS)

        if pending_disconnects.get(client_id) is not asyncio.current_task():
            return

        active = active_connections.get(client_id)
        if active is not None:
            logger.debug(
                "Skipping delayed remove for %s: active epoch %s (stale epoch %s)",
                client_id,
                active.get("epoch"),
                epoch,
            )
            pending_disconnects.pop(client_id, None)
            return

        pending_disconnects.pop(client_id, None)
        world.remove_player(client_id)
    except asyncio.CancelledError:
        raise


async def _cleanup_connection(client_id: str, connection: dict | None, world):
    if connection is None:
        return
    # Reconnect/restart may already own the slot. Only the exact registered
    # connection object is allowed to clean it up.
    if active_connections.get(client_id) is not connection:
        return

    epoch = connection.get("epoch")
    active_connections.pop(client_id, None)
    task = connection.get("task")
    if task is not None:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    # Waiting for the sender task yields control: a new session with the same
    # player id may have registered in the meantime, so re-check before
    # touching player input or scheduling a removal.
    if active_connections.get(client_id) is not None:
        return
    if getattr(world, "draining", False):
        # Restart clears the world and cancels pending removals itself.
        return

    world.reset_player_input(client_id)

    # Nothing to remove (e.g. the handshake was rejected by a restart).
    if client_id not in world.players and client_id not in world.spectators:
        return

    _cancel_pending_disconnect(client_id)
    pending_disconnects[client_id] = asyncio.create_task(delayed_remove(client_id, epoch, world))


async def _reject_after_restart(client_id: str, connection: dict, world) -> None:
    """Drop the identity of a handshake that survived into a restarted world.

    Only a connection that still owns the active slot may remove its player.
    A newer session that took the id over must keep its snake and socket.
    """
    if active_connections.get(client_id) is connection:
        active_connections.pop(client_id, None)
        task = connection.get("task")
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        # Cancelling the sender yields control: a newer session may have
        # claimed the id in the meantime and must keep its player.
        if active_connections.get(client_id) is not None:
            return
        # During an active drain, reset_state() owns cleanup and clears players
        # and events itself. Otherwise this identity is a ghost of the restart.
        if not getattr(world, "draining", False):
            world.remove_player(client_id)


async def websocket_endpoint(
    websocket: WebSocket,
    nickname: str = "Игрок",
    skin: str = "#22c55e",
    client_id: str | None = None,
    role: str = "player",
):
    world = websocket.app.state.world
    if getattr(world, "draining", False):
        # Accept first so the browser actually receives the restart code;
        # a close before accept is surfaced by uvicorn as HTTP 403. No player
        # or connection entry is created during the drain window.
        await websocket.accept()
        await websocket.close(code=1012, reason="Server restarting")
        return
    restart_epoch = getattr(world, "restart_epoch", 0)
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

    # A restart may have completed while accept() was pending. Close before
    # touching the freshly reset world.
    if _lifecycle_changed(world, restart_epoch):
        await websocket.close(code=1012, reason="Server restarting")
        return

    initialized = False
    connection = None
    closed = False
    try:
        if not await _handle_reconnection(
            client_id,
            reconnecting,
            nickname,
            skin,
            websocket,
            world,
            role,
            restart_epoch,
        ):
            closed = True
            await websocket.close(code=1012, reason="Server restarting")
            return

        # Claim the id before the FULL send: a newer handshake can otherwise
        # register while this send is blocked and be overwritten afterwards.
        try:
            connection = _claim_connection(client_id, websocket)
        except BaseException:
            world.remove_player(client_id)
            raise
        await _send_full_state(client_id, websocket, world)

        if active_connections.get(client_id) is not connection:
            # A newer handshake took the slot over while FULL was in flight.
            closed = True
            await websocket.close(code=1012, reason="Connection superseded")
            return

        _start_sender(client_id, connection, world)
        initialized = True
        # A successful handshake supersedes any delayed removal for this id.
        _cancel_pending_disconnect(client_id)
        if _lifecycle_changed(world, restart_epoch):
            # Restart ran during FULL send while this connection still owned
            # the slot. Remove only this identity, never a newer session.
            await _reject_after_restart(client_id, connection, world)
            closed = True
            await websocket.close(code=1012, reason="Server restarting")
            return
        await _run_receive_loop(client_id, websocket, world)
    except Exception:
        logger.debug("WebSocket session failed", exc_info=True)
    finally:
        await _cleanup_connection(client_id, connection, world)
        if not initialized:
            # Drop the identity only if this handshake owned the slot and no
            # newer session took it over. During drain/reset the restart path
            # owns cleanup.
            if (
                connection is not None
                and active_connections.get(client_id) is None
                and not getattr(world, "draining", False)
            ):
                _cancel_pending_disconnect(client_id)
                world.remove_player(client_id)
            if not closed:
                with contextlib.suppress(Exception):
                    await websocket.close()
