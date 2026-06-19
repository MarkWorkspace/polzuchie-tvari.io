# ROLE: Admin REST API.
import os
import asyncio
import hmac
import zlib
from fastapi import Header, HTTPException, Response, Cookie, Request

from app.engine.systems import snake_pb2

from app.engine.entities import Food
from app.api.websocket import (
    active_connections,
    replace_queued_state,
    pending_disconnects,
)


def admin_password():
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password.strip('\r\n"')
    if os.getenv("ENVIRONMENT") != "production":
        print(
            "[WARNING] Using default admin password 'admin'. Set ADMIN_PASSWORD env var for production!"
        )
        return "admin"
    return None


from pydantic import BaseModel

class LoginRequest(BaseModel):
    password: str

async def admin_login(req: LoginRequest, response: Response):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if not hmac.compare_digest(req.password, expected_password):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    
    response.set_cookie(
        key="admin_token",
        value=req.password,
        httponly=True,
        samesite="strict",
        max_age=86400 * 30
    )
    return {"status": "ok"}


def require_admin(
    admin_token: str | None = Cookie(default=None)
):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if not admin_token or not hmac.compare_digest(admin_token, expected_password):
        raise HTTPException(status_code=401, detail="Invalid admin password")


async def get_admin_config(request: Request):
    return request.app.state.world.get_config()


async def patch_admin_config(patch: dict, request: Request):
    try:
        return request.app.state.world.update_config(patch)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def health_check():
    return {"status": "ok"}


def _build_restart_message() -> bytes:
    frame = snake_pb2.GameStateFrame()
    frame.type = snake_pb2.GameStateFrame.FrameType.SERVER_RESTART
    frame.restart_message = "Сервер перезагружается..."
    return zlib.compress(frame.SerializeToString(), 1)


async def _queue_restart_message(shutdown_message: bytes) -> None:
    for client_id, connection in list(active_connections.items()):
        try:
            replace_queued_state(connection["queue"], (shutdown_message, set(), True))
            await asyncio.sleep(0.01)
        except Exception:
            pass


async def _close_active_connections() -> None:
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


def _cancel_pending_disconnects() -> None:
    for task in pending_disconnects.values():
        task.cancel()
    pending_disconnects.clear()


async def admin_restart_game(request: Request):
    print("[Admin] Game restart requested. Notifying all clients...")

    await _queue_restart_message(_build_restart_message())
    await _close_active_connections()
    _cancel_pending_disconnects()
    request.app.state.world.reset_state()

    print("[Admin] Game state reset complete. Clients will auto-reconnect.")
    return {"status": "ok", "message": "Game restarted"}
