import os
import asyncio
import hmac
import msgpack
import math
import random
import zlib
from fastapi import Header, HTTPException

from app.engine.state import game
from app.engine.entities import Food
from app.api.websocket import (
    active_connections,
    replace_queued_state,
    pending_disconnects,
)


def admin_password():
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password
    if os.getenv("ENVIRONMENT") != "production":
        print(
            "[WARNING] Using default admin password 'admin'. Set ADMIN_PASSWORD env var for production!"
        )
        return "admin"
    return None


def require_admin(
    x_admin_password: str | None = Header(default=None, alias="x-admin-password")
):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if not hmac.compare_digest(x_admin_password or "", expected_password):
        raise HTTPException(status_code=401, detail="Invalid admin password")


async def get_admin_config():
    return game.get_config()


async def patch_admin_config(patch: dict):
    try:
        return game.update_config(patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def health_check():
    return {"status": "ok"}


async def admin_restart_game():
    print("[Admin] Game restart requested. Notifying all clients...")

    shutdown_message = zlib.compress(
        msgpack.packb(
            {"type": "SERVER_RESTART", "message": "Сервер перезагружается..."}
        )
    )
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

    for task in pending_disconnects.values():
        task.cancel()
    pending_disconnects.clear()

    # Reset game state while preserving configuration
    game.reset_state()

    print("[Admin] Game state reset complete. Clients will auto-reconnect.")
    return {"status": "ok", "message": "Game restarted"}
