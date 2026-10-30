# ROLE: Player session store and POST/DELETE /session cookie endpoints.
# Does not authenticate WebSocket connections, run game logic or manage spectator identity.
import secrets
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Mapping

from fastapi import Cookie, HTTPException, Request, Response

PLAYER_SESSION_COOKIE = "player_session"
PLAYER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
MAX_PLAYER_SESSIONS = 10_000
PLAYER_SESSION_RATE_LIMIT = 30
PLAYER_SESSION_RATE_WINDOW_SECONDS = 60
PLAYER_SESSION_CLEANUP_INTERVAL_SECONDS = 60


@dataclass(slots=True)
class PlayerSession:
    player_id: str
    created_at: float
    last_seen: float


# Single-process app: in-memory sessions survive until restart. A restart
# invalidates player cookies, which is acceptable for this deployment.
_player_sessions: dict[str, PlayerSession] = {}
_session_requests: dict[str, deque[float]] = {}
_last_cleanup_at = 0.0


def _now() -> float:
    # Monotonic time: wall-clock jumps must not expire or resurrect sessions.
    return time.monotonic()


def _is_expired(session: PlayerSession, now: float) -> bool:
    # Absolute 30-day lifetime; last_seen is used only for cap eviction.
    return now - session.created_at >= PLAYER_SESSION_TTL_SECONDS


def _prune_sessions(now: float | None = None) -> None:
    global _last_cleanup_at
    now = _now() if now is None else now
    _last_cleanup_at = now
    expired = [token for token, session in _player_sessions.items() if _is_expired(session, now)]
    for token in expired:
        _player_sessions.pop(token, None)


def _maybe_prune_sessions(now: float) -> None:
    if now - _last_cleanup_at < PLAYER_SESSION_CLEANUP_INTERVAL_SECONDS:
        return
    _prune_sessions(now)


def _enforce_session_cap() -> None:
    if MAX_PLAYER_SESSIONS <= 0:
        return
    while len(_player_sessions) >= MAX_PLAYER_SESSIONS:
        oldest_token = min(_player_sessions, key=lambda token: _player_sessions[token].last_seen)
        _player_sessions.pop(oldest_token, None)


def create_session() -> tuple[str, PlayerSession]:
    now = _now()
    # New sessions are rare, so prune expired entries eagerly and keep the
    # resolving path (used by WS auth) on the throttled cleanup schedule.
    _prune_sessions(now)
    _enforce_session_cap()
    token = secrets.token_urlsafe(32)
    session = PlayerSession(player_id=str(uuid.uuid4()), created_at=now, last_seen=now)
    _player_sessions[token] = session
    return token, session


def resolve_player_session(token: str | None, *, touch: bool = True) -> PlayerSession | None:
    """Return the live session for an opaque token, or None when expired/unknown."""
    if not token:
        return None
    now = _now()
    _maybe_prune_sessions(now)
    session = _player_sessions.get(token)
    if session is None:
        return None
    if _is_expired(session, now):
        _player_sessions.pop(token, None)
        return None
    if touch:
        session.last_seen = now
    return session


def session_token_from_cookies(cookies: Mapping[str, str] | None) -> str | None:
    """Read the player token from a parsed cookie mapping (HTTP Request or WebSocket)."""
    if not cookies:
        return None
    return cookies.get(PLAYER_SESSION_COOKIE) or None


def resolve_session_from_cookies(cookies: Mapping[str, str] | None) -> PlayerSession | None:
    return resolve_player_session(session_token_from_cookies(cookies))


def _client_key(request: Request) -> str:
    # nginx is the only ingress in the shipped compose stack; it sets
    # X-Real-IP to the browser address. Fall back to the socket peer.
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    if not forwarded:
        forwarded = request.headers.get("x-real-ip", "").strip()
    if forwarded:
        return forwarded
    if request.client is None:
        return "unknown"
    return request.client.host


def _prune_session_requests(now: float) -> None:
    for key, attempts in list(_session_requests.items()):
        while attempts and attempts[0] < now - PLAYER_SESSION_RATE_WINDOW_SECONDS:
            attempts.popleft()
        if not attempts:
            _session_requests.pop(key, None)


def _is_session_rate_limited(key: str, now: float) -> bool:
    attempts = _session_requests.setdefault(key, deque())
    while attempts and attempts[0] < now - PLAYER_SESSION_RATE_WINDOW_SECONDS:
        attempts.popleft()
    return len(attempts) >= PLAYER_SESSION_RATE_LIMIT


def _record_session_request(key: str, now: float) -> None:
    _session_requests.setdefault(key, deque()).append(now)


def _is_secure_request(request: Request) -> bool:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
    return forwarded_proto.lower() == "https" or request.url.scheme == "https"


def _set_session_cookie(response: Response, token: str, request: Request) -> None:
    response.set_cookie(
        key=PLAYER_SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=_is_secure_request(request),
        max_age=PLAYER_SESSION_TTL_SECONDS,
        path="/",
    )


def _clear_session_cookie(response: Response, request: Request) -> None:
    response.delete_cookie(
        PLAYER_SESSION_COOKIE,
        path="/",
        secure=_is_secure_request(request),
        httponly=True,
        samesite="lax",
    )


async def create_player_session(
    request: Request,
    response: Response,
    session_token: str | None = Cookie(default=None, alias=PLAYER_SESSION_COOKIE),
):
    now = _now()
    _prune_session_requests(now)
    key = _client_key(request)
    if _is_session_rate_limited(key, now):
        raise HTTPException(
            status_code=429,
            detail="Too many session requests",
            headers={"Retry-After": str(PLAYER_SESSION_RATE_WINDOW_SECONDS)},
        )
    _record_session_request(key, now)

    session = resolve_player_session(session_token)
    if session is None:
        token, session = create_session()
    else:
        token = session_token
    _set_session_cookie(response, token, request)
    response.headers["Cache-Control"] = "no-store"
    return {"player_id": session.player_id}


async def delete_player_session(
    request: Request,
    response: Response,
    session_token: str | None = Cookie(default=None, alias=PLAYER_SESSION_COOKIE),
):
    if session_token:
        _player_sessions.pop(session_token, None)
    _clear_session_cookie(response, request)
    response.headers["Cache-Control"] = "no-store"
    return {"status": "ok"}
