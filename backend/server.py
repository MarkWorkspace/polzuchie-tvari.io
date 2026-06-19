# ROLE: Точка входа FastAPI. Не содержит игровой логики.
import sys
import os
import asyncio
import contextlib
import traceback
from app.engine.systems import snake_pb2
import uvicorn
import zlib
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, WebSocket, APIRouter, Depends
from fastapi.middleware.cors import CORSMiddleware

# Ensure the backend directory is in the sys.path for app module discovery
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
from app.engine.state import World
from app.api.websocket import (
    active_connections,
    websocket_endpoint,
    replace_queued_state,
)
from app.api.admin import (
    get_admin_config,
    patch_admin_config,
    health_check,
    admin_restart_game,
    require_admin,
    admin_login,
)


async def process_client(client_id, connection, world):
    is_full_sync = connection.get("needs_full_sync", False)
    if is_full_sync and connection["queue"].full():
        return

    if is_full_sync:
        frame, visible_players = world.get_delta_state(
            client_id,
            is_full=True,
            update_visibility=False,
            return_visibility=True,
            serialize_proto=False,
        )
        frame.your_id = client_id
        for f in world.food_manager.foods.values():
            f_msg = frame.foods.add()
            f_msg.id, f_msg.x, f_msg.y, f_msg.value, f_msg.color, f_msg.image = f.id, f.x, f.y, f.value, f.color, f.image or ""
        state_bytes = frame.SerializeToString()
        connection["needs_full_sync"] = False
    else:
        state_bytes, visible_players = world.get_delta_state(
            client_id,
            update_visibility=False,
            return_visibility=True,
            serialize_proto=True,
        )
        
    compressed = await asyncio.to_thread(zlib.compress, state_bytes, 1)
    skipped = replace_queued_state(connection["queue"], (compressed, visible_players, is_full_sync))
    if skipped:
        connection["needs_full_sync"] = True



async def game_loop(world):
    """Global game loop executing physics ticks and broadcasting states"""
    while True:
        start_time = asyncio.get_event_loop().time()
        try:
            for cid, data in world.input_queue:
                world.update_direction(cid, data)
            world.input_queue.clear()
            world.tick()
        except Exception as e:
            traceback.print_exc()
            elapsed = asyncio.get_event_loop().time() - start_time
            await asyncio.sleep(max(0.0, world.tick_interval - elapsed))
            continue

        tasks = [
            process_client(cid, conn, world) for cid, conn in list(active_connections.items())
        ]
        if tasks:
            await asyncio.gather(*tasks)

        elapsed = asyncio.get_event_loop().time() - start_time
        await asyncio.sleep(max(0.0, world.tick_interval - elapsed))


@asynccontextmanager
async def lifespan(app):
    world = World()
    app.state.world = world
    task = asyncio.create_task(game_loop(world))
    yield
    print("[Server] Graceful shutdown initiated...")
    frame = snake_pb2.GameStateFrame()
    frame.type = snake_pb2.GameStateFrame.FrameType.SERVER_RESTART
    frame.restart_message = "Сервер перезагружается для обновления..."
    shutdown_message = zlib.compress(frame.SerializeToString())
    for client_id, connection in list(active_connections.items()):
        try:
            replace_queued_state(connection["queue"], (shutdown_message, set(), True))
            await asyncio.sleep(0.01)
        except Exception:
            pass

    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(lifespan=lifespan)

is_prod = os.getenv("ENVIRONMENT") == "production"
if is_prod:
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex="https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# REST endpoints routing (mapped to handlers in app/api/admin.py)
app.post("/admin/login")(admin_login)

admin_router = APIRouter(dependencies=[Depends(require_admin)])
admin_router.get("/admin/config")(get_admin_config)
admin_router.get("/ws/admin/config")(get_admin_config)
admin_router.patch("/admin/config")(patch_admin_config)
admin_router.patch("/ws/admin/config")(patch_admin_config)
admin_router.post("/admin/restart")(admin_restart_game)
admin_router.post("/ws/admin/restart")(admin_restart_game)
app.include_router(admin_router)

app.get("/health")(health_check)
app.get("/ws/health")(health_check)

# WebSockets routing (mapped to handlers in app/api/websocket.py)
app.websocket("/ws")(websocket_endpoint)
app.websocket("/ws/")(websocket_endpoint)

if __name__ == "__main__":
    is_dev = os.getenv("ENVIRONMENT") != "production"
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=is_dev,
        reload_excludes=["*venv*", "*__pycache__*"] if is_dev else None,
    )
