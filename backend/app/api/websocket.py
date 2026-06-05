import asyncio
import contextlib
import re
import uuid
import msgpack
import zlib
from collections import deque
from fastapi import WebSocket

from app.engine.entities import Food
from app.engine.state import GameState

# We import the singleton game instance
from app.engine.state import game

active_connections = {}
pending_disconnects = {}

MAX_CONNECTIONS = 50
RATE_LIMIT_PER_SECOND = 30
VALID_SKINS = frozenset({"zebra", "tiger", "rainbow", "cyberpunk"})
HEX_COLOR_PATTERN = re.compile(r'^#[0-9a-fA-F]{6}$')
NICKNAME_MAX_LENGTH = 16

async def sender_loop(client_id, websocket, queue):
    try:
        while True:
            data, visible_players = await queue.get()
            await websocket.send_bytes(data)
            game.set_client_visibility(client_id, visible_players)
    except asyncio.CancelledError:
        raise
    except Exception:
        pass  # Cleanup handled by websocket_endpoint finally block

def replace_queued_state(queue, data):
    if queue.full():
        with contextlib.suppress(asyncio.QueueEmpty):
            queue.get_nowait()
    with contextlib.suppress(asyncio.QueueFull):
        queue.put_nowait(data)

async def websocket_endpoint(
    websocket: WebSocket,
    nickname: str = "Игрок",
    skin: str = "#22c55e",
    client_id: str | None = None
):
    reconnecting = False
    if client_id:
        try:
            uuid.UUID(client_id)
            if client_id in game.players:
                reconnecting = True
        except ValueError:
            client_id = None

    if not client_id:
        client_id = str(uuid.uuid4())
    
    if len(active_connections) >= MAX_CONNECTIONS and not reconnecting:
        await websocket.close(code=4002, reason="Server full")
        return
    
    nickname = nickname.strip()[:NICKNAME_MAX_LENGTH] or "Игрок"
    
    if skin not in VALID_SKINS and not HEX_COLOR_PATTERN.match(skin):
        skin = "#22c55e"
    
    await websocket.accept()

    # Cancel pending disconnect if reconnecting
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
    else:
        game.add_player(client_id, nickname, skin)
    
    full_state = game.get_full_state(client_id)
    full_state["your_id"] = client_id
    await websocket.send_bytes(zlib.compress(msgpack.packb(full_state)))

    send_queue = asyncio.Queue(maxsize=1)
    send_task = asyncio.create_task(sender_loop(client_id, websocket, send_queue))
    active_connections[client_id] = {"websocket": websocket, "queue": send_queue, "task": send_task}
    
    msg_timestamps = deque()
    
    try:
        while True:
            data = await websocket.receive_text()
            if len(data) > 20:
                continue
            
            now = asyncio.get_event_loop().time()
            msg_timestamps.append(now)
            while msg_timestamps and msg_timestamps[0] < now - 1.0:
                msg_timestamps.popleft()
            if len(msg_timestamps) > RATE_LIMIT_PER_SECOND:
                continue
            
            if data.startswith("SCORE:"):
                try:
                    val = int(data[6:])
                    if val >= 0:
                        game.update_player_score(client_id, val)
                except ValueError:
                    pass
                continue

            if data.startswith("PING:"):
                try:
                    await websocket.send_text(f"PONG:{data[5:]}")
                except Exception:
                    pass
                continue
            
            game.update_direction(client_id, data)
    except Exception:
        pass
    finally:
        conn = active_connections.get(client_id)
        if conn and conn["websocket"] == websocket:
            active_connections.pop(client_id, None)
            conn["task"].cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await conn["task"]
            
            game.reset_player_input(client_id)

            async def delayed_remove(cid):
                try:
                    await asyncio.sleep(3.0)
                    game.remove_player(cid)
                    pending_disconnects.pop(cid, None)
                except asyncio.CancelledError:
                    pass

            pending_disconnects[client_id] = asyncio.create_task(delayed_remove(client_id))
