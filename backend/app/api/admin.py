import os
import asyncio
import msgpack
import math
import random
import zlib
from fastapi import Header, HTTPException

from app.engine.state import game
from app.engine.entities import Food
from app.api.websocket import active_connections, replace_queued_state

def admin_password():
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password
    if os.getenv("ENVIRONMENT") != "production":
        print("[WARNING] Using default admin password 'admin'. Set ADMIN_PASSWORD env var for production!")
        return "admin"
    return None

def require_admin(x_admin_password: str | None = Header(default=None)):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if x_admin_password != expected_password:
        raise HTTPException(status_code=401, detail="Invalid admin password")

async def get_admin_config(x_admin_password: str | None = Header(default=None, alias="x-admin-password")):
    require_admin(x_admin_password)
    return game.get_config()

async def patch_admin_config(patch: dict, x_admin_password: str | None = Header(default=None, alias="x-admin-password")):
    require_admin(x_admin_password)
    try:
        return game.update_config(patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

async def health_check():
    return {
        "status": "ok",
        "players": len(game.players),
        "connections": len(active_connections),
        "food_count": len(game.foods),
        "tick_rate": game.config.simulation.tick_rate
    }

async def admin_restart_game(x_admin_password: str | None = Header(default=None, alias="x-admin-password")):
    require_admin(x_admin_password)
    print("[Admin] Game restart requested. Notifying all clients...")

    shutdown_message = zlib.compress(msgpack.packb({"type": "SERVER_RESTART", "message": "Сервер перезагружается..."}))
    for client_id, connection in list(active_connections.items()):
        try:
            replace_queued_state(connection["queue"], (shutdown_message, set()))
            await asyncio.sleep(0.01)
        except Exception:
            pass

    for client_id, connection in list(active_connections.items()):
        try:
            await connection["websocket"].close(code=1012, reason="Server restart")
        except Exception:
            pass
        try:
            connection["task"].cancel()
        except Exception:
            pass

    active_connections.clear()

    # Reset game state while preserving configuration
    game.players.clear()
    game.client_visibility.clear()
    game.foods.clear()
    game.food_id_counter = 0
    game.new_foods.clear()
    game.eaten_foods.clear()
    game.pending_eaten_foods.clear()
    game.kill_events.clear()
    game.moved_foods.clear()
    game.player_grid.clear()
    game.full_players_dict.clear()
    game.mini_players_dict.clear()
    game.cluster_timer = 0.0
    game._max_player_body_len = 1
    game.clusters = game._create_clusters()
    game._generate_portals()
    game._update_black_hole_slots(force_roll=True)

    # Re-spawn food
    for _ in range(game.target_food_count):
        f = game._spawn_food()
        game.foods[f.id] = f

    print("[Admin] Game state reset complete. Clients will auto-reconnect.")
    return {"status": "ok", "message": "Game restarted"}
