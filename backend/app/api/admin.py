# ROLE: Admin REST API. Session cookie auth, config read/write, restart, audit log. Not game logic.
import os
import asyncio
import contextlib
import hmac
import inspect
import ipaddress
import json
import logging
import secrets
import time
import zlib
from collections import deque
from datetime import datetime, timezone

from fastapi import HTTPException, Response, Cookie, Request
from fastapi.responses import JSONResponse
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
MAX_LOGIN_RATE_KEYS = 10_000

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


def _trust_proxy_headers() -> bool:
    """Whether forwarding headers may be trusted.

    Default true in production (the shipped compose stack always sits behind
    nginx) and false in local dev, where uvicorn is reached directly.
    ``TRUST_PROXY_HEADERS`` overrides the default for both.
    """
    raw = os.getenv("TRUST_PROXY_HEADERS")
    if raw is None:
        return os.getenv("ENVIRONMENT") == "production"
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_ip(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def _login_key(request: Request | None) -> str:
    if request is None:
        return "unknown"
    # nginx overwrites X-Real-IP with the browser address. Honour only that
    # header behind a trusted proxy; X-Forwarded-For is attacker-controlled and
    # must never create a fresh login bucket. Invalid values fall back to the
    # socket peer instead of being trusted.
    headers = getattr(request, "headers", None)
    if _trust_proxy_headers() and headers is not None:
        real_ip = _parse_ip(headers.get("x-real-ip"))
        if real_ip is not None:
            return real_ip
    client = getattr(request, "client", None)
    host = getattr(client, "host", None)
    if not host:
        return "unknown"
    return _parse_ip(host) or host


def _audit(request: Request | None, event: str, **fields) -> None:
    """Write one JSON audit record. Never pass passwords, tokens or values."""
    record = {
        "timestamp": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "event": event,
        "ip": _login_key(request),
        **fields,
    }
    logger.info(json.dumps(record, ensure_ascii=False))


def _prune_login_attempts(now: float | None = None) -> None:
    now = time.monotonic() if now is None else now
    for key, attempts in list(_login_attempts.items()):
        while attempts and attempts[0] < now - LOGIN_RATE_WINDOW_SECONDS:
            attempts.popleft()
        if not attempts:
            _login_attempts.pop(key, None)


def _evict_oldest_login_key() -> None:
    oldest = min(_login_attempts, key=lambda key: _login_attempts[key][-1])
    _login_attempts.pop(oldest, None)


def _login_attempts_for(key: str) -> deque[float]:
    now = time.monotonic()
    attempts = _login_attempts.get(key)
    if attempts is None:
        if len(_login_attempts) >= MAX_LOGIN_RATE_KEYS:
            _prune_login_attempts(now)
        if len(_login_attempts) >= MAX_LOGIN_RATE_KEYS:
            _evict_oldest_login_key()
        attempts = deque()
        _login_attempts[key] = attempts
    while attempts and attempts[0] < now - LOGIN_RATE_WINDOW_SECONDS:
        attempts.popleft()
    return attempts


def _is_login_rate_limited(key: str) -> bool:
    return len(_login_attempts_for(key)) >= LOGIN_RATE_LIMIT


def _record_login_attempt(key: str) -> None:
    _login_attempts_for(key).append(time.monotonic())


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
            _audit(request, "login", result="rate_limited")
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts",
                headers={"Retry-After": str(LOGIN_RATE_WINDOW_SECONDS)},
            )
        _record_login_attempt(key)
        _audit(request, "login", result="failure")
        raise HTTPException(status_code=401, detail="Invalid admin password")

    _login_attempts.pop(key, None)
    _audit(request, "login", result="success")
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
    # Only top-level keys are logged: nested values may contain operator data.
    keys = sorted(patch.model_fields_set)
    try:
        result = request.app.state.world.update_config(patch.model_dump(exclude_unset=True))
    except ValueError as exc:
        _audit(request, "config", result="failure", keys=keys)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        _audit(request, "config", result="failure", keys=keys)
        raise HTTPException(
            status_code=503,
            detail="Configuration was validated but could not be persisted",
        ) from exc
    except Exception as exc:
        logger.exception("Failed to apply admin config")
        _audit(request, "config", result="failure", keys=keys)
        raise HTTPException(
            status_code=503,
            detail="Configuration was validated but could not be applied",
        ) from exc
    _audit(request, "config", result="success", keys=keys)
    return result


async def health_check():
    return {"status": "ok"}


def _tick_metrics(world, now: float | None = None) -> dict:
    """Tick heartbeat fields shared by readiness and admin health."""
    now = time.monotonic() if now is None else now
    last_tick = getattr(world, "last_tick_monotonic", now)
    return {
        "tick_age_ms": round(max(0.0, now - last_tick) * 1000.0, 1),
        "tick_count": int(getattr(world, "tick_count", 0)),
        "tick_duration_ms": float(getattr(world, "tick_duration_ms", 0.0)),
        "tick_errors": int(getattr(world, "tick_errors", 0)),
    }


async def readiness_check(request: Request):
    """Readiness: is the game loop producing fresh ticks?

    Liveness stays on /health. This endpoint returns 503 when the heartbeat is
    older than max(2s, five tick intervals), so a hung tick is visible without
    restarting the in-memory game on a short stall.
    """
    world = request.app.state.world
    now = time.monotonic()
    age = max(0.0, now - world.last_tick_monotonic)
    stale_after = max(2.0, world.tick_interval * 5)
    payload = {
        "status": "ready" if age <= stale_after else "stale",
        **_tick_metrics(world, now),
    }
    if payload["status"] == "stale":
        return JSONResponse(status_code=503, content=payload)
    return payload


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
        **_tick_metrics(world),
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


async def _cancel_and_wait(task) -> None:
    """Cancel a background task and wait until it stops.

    Fake tasks in tests are not awaitable; for them only ``cancel`` runs.
    """
    if task is None:
        return
    try:
        task.cancel()
    except Exception:
        logger.debug("Failed to cancel background task", exc_info=True)
        return
    if inspect.isawaitable(task):
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task


async def _close_active_connections() -> None:
    for client_id, connection in list(active_connections.items()):
        # Detach first: endpoint cleanup must not schedule a delayed removal
        # for a session that restart is clearing anyway.
        if active_connections.get(client_id) is connection:
            active_connections.pop(client_id, None)
        try:
            await connection["websocket"].close(code=1012, reason="Server restart")
        except Exception:
            logger.debug("Failed to close WebSocket during restart", exc_info=True)
        await _cancel_and_wait(connection.get("task"))


async def _cancel_pending_disconnects() -> None:
    tasks = list(pending_disconnects.values())
    pending_disconnects.clear()
    for task in tasks:
        await _cancel_and_wait(task)


async def admin_restart_game(request: Request):
    logger.info("Game restart requested. Notifying all clients...")
    world = request.app.state.world

    # Reject new handshakes for the whole shutdown window. Without this flag a
    # connection can register between closing sockets and reset_state() and
    # become a ghost after the restart.
    world.draining = True
    try:
        await _queue_restart_message(_build_restart_message())
        await _close_active_connections()
        await _cancel_pending_disconnects()
        world.reset_state()
    except Exception:
        _audit(request, "restart", result="failure")
        raise
    finally:
        world.draining = False

    _audit(request, "restart", result="success")
    logger.info("Game state reset complete. Clients will auto-reconnect.")
    return {"status": "ok", "message": "Game restarted"}
