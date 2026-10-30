# ROLE: Player session cookie/store regressions: cookie flags, reuse, delete, TTL, cap,
# rate limit, cookie resolver and spectator isolation. Does not test WS auth or gameplay.
import time
import uuid

import pytest
from fastapi.testclient import TestClient

import server
from app.api import session as session_module
from app.api.session import (
    PLAYER_SESSION_COOKIE,
    PLAYER_SESSION_RATE_LIMIT,
    PLAYER_SESSION_RATE_WINDOW_SECONDS,
    PLAYER_SESSION_TTL_SECONDS,
    PlayerSession,
    create_session,
    resolve_session_from_cookies,
    session_token_from_cookies,
)


@pytest.fixture(autouse=True)
def clean_session_state():
    session_module._player_sessions.clear()
    session_module._session_requests.clear()
    session_module._last_cleanup_at = 0.0
    yield
    session_module._player_sessions.clear()
    session_module._session_requests.clear()
    session_module._last_cleanup_at = 0.0


def _cookie_header(response) -> str:
    for header in response.headers.get_list("set-cookie"):
        if header.startswith(f"{PLAYER_SESSION_COOKIE}="):
            return header
    raise AssertionError("Player session cookie was not set")


def test_post_session_sets_http_only_lax_cookie_without_token_in_json():
    with TestClient(server.app) as client:
        response = client.post("/session")

        assert response.status_code == 200
        cookie = _cookie_header(response).lower()
        assert "httponly" in cookie
        assert "samesite=lax" in cookie
        assert "path=/" in cookie
        assert f"max-age={PLAYER_SESSION_TTL_SECONDS}" in cookie
        assert "secure" not in cookie

        body = response.json()
        assert set(body) == {"player_id"}
        uuid.UUID(body["player_id"])
        token = client.cookies.get(PLAYER_SESSION_COOKIE)
        assert token
        assert token not in response.text
        assert PLAYER_SESSION_COOKIE not in response.text


def test_session_cookie_is_secure_behind_https_proxy():
    with TestClient(server.app) as client:
        response = client.post("/session", headers={"X-Forwarded-Proto": "https"})

        assert response.status_code == 200
        assert "secure" in _cookie_header(response).lower()
        assert client.cookies.get(PLAYER_SESSION_COOKIE)


def test_session_cookie_is_secure_for_https_scheme():
    with TestClient(server.app, base_url="https://testserver") as client:
        response = client.post("/session")

        assert response.status_code == 200
        assert "secure" in _cookie_header(response).lower()


def test_ws_session_alias_creates_and_deletes_session():
    with TestClient(server.app) as client:
        created = client.post("/ws/session")
        assert created.status_code == 200
        token = client.cookies.get(PLAYER_SESSION_COOKIE)
        assert token in session_module._player_sessions

        assert client.delete("/ws/session").status_code == 200
        assert token not in session_module._player_sessions


def test_repeated_post_reuses_same_player_id_and_token():
    with TestClient(server.app) as client:
        first = client.post("/session").json()
        token = client.cookies.get(PLAYER_SESSION_COOKIE)
        second = client.post("/session").json()

        assert second == first
        assert client.cookies.get(PLAYER_SESSION_COOKIE) == token
        assert len(session_module._player_sessions) == 1


def test_delete_session_invalidates_cookie_and_store():
    with TestClient(server.app) as client:
        first = client.post("/session").json()
        token = client.cookies.get(PLAYER_SESSION_COOKIE)

        deleted = client.delete("/session")
        assert deleted.status_code == 200
        assert deleted.json() == {"status": "ok"}
        assert token not in session_module._player_sessions
        assert client.cookies.get(PLAYER_SESSION_COOKIE) is None

        second = client.post("/session").json()
        assert second["player_id"] != first["player_id"]
        assert client.cookies.get(PLAYER_SESSION_COOKIE) != token


def test_expired_session_creates_a_new_one():
    with TestClient(server.app) as client:
        first = client.post("/session").json()
        token = client.cookies.get(PLAYER_SESSION_COOKIE)
        session_module._player_sessions[token].created_at -= PLAYER_SESSION_TTL_SECONDS + 1

        second = client.post("/session").json()

        assert second["player_id"] != first["player_id"]
        assert token not in session_module._player_sessions
        assert len(session_module._player_sessions) == 1


def test_prune_removes_expired_sessions_only():
    now = time.monotonic()
    session_module._player_sessions["stale"] = PlayerSession(
        "stale-player", now - PLAYER_SESSION_TTL_SECONDS - 1, now
    )
    session_module._player_sessions["fresh"] = PlayerSession("fresh-player", now, now)

    session_module._prune_sessions(now)

    assert set(session_module._player_sessions) == {"fresh"}


def test_session_cap_evicts_least_recently_seen(monkeypatch):
    monkeypatch.setattr(session_module, "MAX_PLAYER_SESSIONS", 2)
    now = time.monotonic()
    session_module._player_sessions["old"] = PlayerSession("old-player", now - 20, now - 10)
    session_module._player_sessions["recent"] = PlayerSession("recent-player", now - 20, now - 1)

    token, session = create_session()

    assert len(session_module._player_sessions) == 2
    assert "old" not in session_module._player_sessions
    assert "recent" in session_module._player_sessions
    assert token in session_module._player_sessions
    assert session_module._player_sessions[token] is session


def test_session_cap_is_enforced_at_endpoint(monkeypatch):
    monkeypatch.setattr(session_module, "MAX_PLAYER_SESSIONS", 2)

    with TestClient(server.app) as client:
        player_ids = []
        for _ in range(3):
            client.cookies.clear()
            response = client.post("/session")
            assert response.status_code == 200
            player_ids.append(response.json()["player_id"])

        stored_ids = {session.player_id for session in session_module._player_sessions.values()}
        assert len(stored_ids) == 2
        assert player_ids[2] in stored_ids
        assert player_ids[0] not in stored_ids


def test_post_session_is_rate_limited_per_forwarded_client():
    with TestClient(server.app) as client:
        first_client = {"X-Real-IP": "203.0.113.1"}
        for _ in range(PLAYER_SESSION_RATE_LIMIT):
            assert client.post("/session", headers=first_client).status_code == 200

        limited = client.post("/session", headers=first_client)
        assert limited.status_code == 429
        assert limited.headers["retry-after"] == str(PLAYER_SESSION_RATE_WINDOW_SECONDS)
        assert "set-cookie" not in limited.headers

        assert client.post("/session", headers={"X-Real-IP": "203.0.113.2"}).status_code == 200


def test_session_token_and_resolver_from_parsed_cookies():
    assert session_token_from_cookies({PLAYER_SESSION_COOKIE: "opaque"}) == "opaque"
    assert session_token_from_cookies({PLAYER_SESSION_COOKIE: ""}) is None
    assert session_token_from_cookies({"other": "opaque"}) is None
    assert session_token_from_cookies(None) is None

    token, session = create_session()
    resolved = resolve_session_from_cookies({PLAYER_SESSION_COOKIE: token})
    assert resolved is session
    assert resolve_session_from_cookies({PLAYER_SESSION_COOKIE: "missing"}) is None


def test_spectator_websocket_does_not_create_or_touch_player_session():
    with TestClient(server.app) as client:
        player = client.post("/session").json()
        token = client.cookies.get(PLAYER_SESSION_COOKIE)
        last_seen = session_module._player_sessions[token].last_seen

        with client.websocket_connect("/ws?role=spectator") as websocket:
            websocket.receive_bytes()

        assert len(session_module._player_sessions) == 1
        assert session_module._player_sessions[token].player_id == player["player_id"]
        assert session_module._player_sessions[token].last_seen == last_seen
        assert client.cookies.get(PLAYER_SESSION_COOKIE) == token
