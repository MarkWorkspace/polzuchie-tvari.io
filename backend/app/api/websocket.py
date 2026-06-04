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
            game.client_visibility[client_id] = visible_players
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

async def websocket_endpoint(websocket: WebSocket, nickname: str = "Игрок", skin: str = "#22c55e"):
    client_id = str(uuid.uuid4())
    
    if len(active_connections) >= MAX_CONNECTIONS:
        await websocket.close(code=4002, reason="Server full")
        return
    
    nickname = nickname.strip()[:NICKNAME_MAX_LENGTH] or "Игрок"
    
    if skin not in VALID_SKINS and not HEX_COLOR_PATTERN.match(skin):
        skin = "#22c55e"
    
    await websocket.accept()
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
                        if client_id in game.players:
                            p = game.players[client_id]
                            p.score = val
                            game.align_player_growth(p)
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
        connection = active_connections.pop(client_id, None)
        if connection:
            connection["task"].cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await connection["task"]
        game.remove_player(client_id)
