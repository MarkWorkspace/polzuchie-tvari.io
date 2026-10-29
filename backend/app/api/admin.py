# ROLE: Admin REST API. Session cookie auth, config read/write, restart. Not game logic.
import os
import asyncio
import hmac
import logging
import secrets
import time
import zlib
from collections import deque

from fastapi import HTTPException, Response, Cookie, Request
from pydantic import BaseModel

from app.engine.systems import snake_pb2

from app.api.config_schema import AdminConfigPatch
from app.api.websocket import (
    active_connections,
    replace_queued_state,
    pending_disconnects,
)

ADMIN_SESSION_COOKIE = "admin_token"
ADMIN_SESSION_TTL_SECONDS = 12 * 60 * 60
LOGIN_RATE_LIMIT = 10
LOGIN_RATE_WINDOW_SECONDS = 5 * 60

# Single-process app: in-memory sessions are enough. Restarting the server
# invalidates admin sessions and forces a fresh login.
_admin_sessions: dict[str, float] = {}
_login_attempts: dict[str, deque[float]] = {}
_default_password_warned = False
logger = logging.getLogger(__name__)


def admin_password():
    global _default_password_warned
    password = os.getenv("ADMIN_PASSWORD")
    if password:
        return password.strip(" \t\r\n\"'")
    if os.getenv("ENVIRONMENT") != "production":
        if not _default_password_warned:
            logger.warning(
                "Using default admin password 'admin'. Set ADMIN_PASSWORD env var for production!"
            )
            _default_password_warned = True
        return "admin"
    return None


def _prune_admin_sessions(now: float | None = None) -> None:
    # Monotonic time: NTP jumps must not extend or expire in-memory sessions.
    now = time.monotonic() if now is None else now
    expired = [token for token, expires_at in _admin_sessions.items() if expires_at <= now]
    for token in expired:
        _admin_sessions.pop(token, None)


def _create_admin_session() -> str:
    _prune_admin_sessions()
    token = secrets.token_urlsafe(32)
    _admin_sessions[token] = time.monotonic() + ADMIN_SESSION_TTL_SECONDS
    return token


def _is_valid_admin_session(token: str | None) -> bool:
    if not token:
        return False
    _prune_admin_sessions()
    return _admin_sessions.get(token, 0.0) > time.monotonic()


def _login_key(request: Request | None) -> str:
    if request is None:
        return "unknown"
    # nginx is the only ingress in the shipped compose stack; it sets
    # X-Real-IP to the browser address. Fall back to the socket peer.
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0]
    if not forwarded.strip():
        forwarded = request.headers.get("x-real-ip", "")
    if forwarded.strip():
        return forwarded.strip()
    if request.client is None:
        return "unknown"
    return request.client.host


def _prune_login_attempts(now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    for key, attempts in list(_login_attempts.items()):
        while attempts and attempts[0] < now - LOGIN_RATE_WINDOW_SECONDS:
            attempts.popleft()
        if not attempts:
            _login_attempts.pop(key, None)


def _is_login_rate_limited(key: str) -> bool:
    now = time.monotonic()
    attempts = _login_attempts.setdefault(key, deque())
    while attempts and attempts[0] < now - LOGIN_RATE_WINDOW_SECONDS:
        attempts.popleft()
    return len(attempts) >= LOGIN_RATE_LIMIT


def _record_login_attempt(key: str) -> None:
    _login_attempts.setdefault(key, deque()).append(time.monotonic())


def _is_secure_request(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
    return forwarded_proto == "https" or request.url.scheme == "https"


class LoginRequest(BaseModel):
    password: str


async def admin_login(req: LoginRequest, response: Response, request: Request):
    _prune_login_attempts()
    key = _login_key(request)
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if not hmac.compare_digest(req.password.encode(), expected_password.encode()):
        if _is_login_rate_limited(key):
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts",
                headers={"Retry-After": str(LOGIN_RATE_WINDOW_SECONDS)},
            )
        _record_login_attempt(key)
        raise HTTPException(status_code=401, detail="Invalid admin password")

    _login_attempts.pop(key, None)
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=_create_admin_session(),
        httponly=True,
        samesite="strict",
        secure=_is_secure_request(request),
        max_age=ADMIN_SESSION_TTL_SECONDS,
        path="/",
    )
    return {"status": "ok"}


async def admin_logout(
    response: Response,
    admin_token: str | None = Cookie(default=None),
):
    if admin_token:
        _admin_sessions.pop(admin_token, None)
    response.delete_cookie(ADMIN_SESSION_COOKIE, path="/")
    return {"status": "ok"}


async def admin_session(admin_token: str | None = Cookie(default=None)):
    configured = admin_password() is not None
    return {
        "authenticated": configured and _is_valid_admin_session(admin_token),
        "configured": configured,
    }


def require_admin(admin_token: str | None = Cookie(default=None)):
    expected_password = admin_password()
    if not expected_password:
        raise HTTPException(status_code=403, detail="ADMIN_PASSWORD is not configured")
    if not _is_valid_admin_session(admin_token):
        raise HTTPException(status_code=401, detail="Invalid admin session")


async def get_admin_config(request: Request):
    return request.app.state.world.get_config()


async def patch_admin_config(patch: AdminConfigPatch, request: Request):
    try:
        return request.app.state.world.update_config(patch.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503,
            detail="Configuration was validated but could not be persisted",
        ) from exc


async def health_check():
    return {"status": "ok"}


async def admin_health(request: Request):
    world = getattr(request.app.state, "world", None)
    bot_manager = getattr(world, "bot_manager", None) if world else None
    bots = bot_manager.bot_count if bot_manager else 0
    total_players = len(world.players) if world else 0
    return {
        "status": "ok",
        "players": max(0, total_players - bots),
        "bots": bots,
        "spectators": len(world.spectators) if world else 0,
    }


def _build_restart_message() -> bytes:
    frame = snake_pb2.GameStateFrame()
    frame.type = snake_pb2.GameStateFrame.FrameType.SERVER_RESTART
    frame.restart_message = "Сервер перезагружается..."
    return zlib.compress(frame.SerializeToString(), 1)


async def _queue_restart_message(shutdown_message: bytes) -> None:
    for connection in list(active_connections.values()):
        try:
            replace_queued_state(connection["queue"], (shutdown_message, set(), True))
            await asyncio.sleep(0.01)
        except Exception:
            logger.debug("Failed to queue restart message", exc_info=True)


async def _close_active_connections() -> None:
    for connection in list(active_connections.values()):
        try:
            await connection["websocket"].close(code=1012, reason="Server restart")
        except Exception:
            logger.debug("Failed to close WebSocket during restart", exc_info=True)
        try:
            connection["task"].cancel()
        except Exception:
            logger.debug("Failed to cancel connection task during restart", exc_info=True)
    active_connections.clear()


def _cancel_pending_disconnects() -> None:
    for task in pending_disconnects.values():
        task.cancel()
    pending_disconnects.clear()


async def admin_restart_game(request: Request):
    logger.info("Game restart requested. Notifying all clients...")

    await _queue_restart_message(_build_restart_message())
    await _close_active_connections()
    _cancel_pending_disconnects()
    request.app.state.world.reset_state()

    logger.info("Game state reset complete. Clients will auto-reconnect.")
    return {"status": "ok", "message": "Game restarted"}
