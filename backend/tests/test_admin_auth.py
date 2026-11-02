# ROLE: Тесты Admin API аутентификации. Проверяет очистку пароля, session-cookie,
# доверие X-Real-IP за прокси и bounded login rate limiter.
import os
import time
from collections import deque

import pytest
from fastapi import Response, HTTPException
from starlette.requests import Request

from app.api import admin as admin_module
from app.api.admin import (
    ADMIN_SESSION_COOKIE,
    LOGIN_RATE_WINDOW_SECONDS,
    LoginRequest,
    _admin_sessions,
    _login_attempts,
    _login_key,
    admin_login,
    admin_logout,
    admin_password,
    admin_session,
    health_check,
    require_admin,
)


def _reset_admin_state():
    _admin_sessions.clear()
    _login_attempts.clear()


def _request(host: str = "test", scheme: str = "http", headers=None) -> Request:
    return Request(
        {
            "type": "http",
            "scheme": scheme,
            "server": ("test", 80),
            "path": "/admin/login",
            "client": (host, 123),
            "headers": headers or [],
            "query_string": b"",
            "root_path": "",
        }
    )


def _session_token(response: Response) -> str:
    for header in response.headers.getlist("set-cookie"):
        if header.startswith(f"{ADMIN_SESSION_COOKIE}="):
            return header.split(";", 1)[0].split("=", 1)[1]
    raise AssertionError("Admin session cookie was not set")


def test_admin_password_stripping():
    original_env = os.environ.get("ADMIN_PASSWORD")
    try:
        # 1. Test standard password
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        assert admin_password() == "povelitel-polzunov"

        # 2. Test password with double quotes
        os.environ["ADMIN_PASSWORD"] = '"povelitel-polzunov"'
        assert admin_password() == "povelitel-polzunov"

        # 3. Test password with single quotes
        os.environ["ADMIN_PASSWORD"] = "'povelitel-polzunov'"
        assert admin_password() == "povelitel-polzunov"

        # 4. Test password with spaces and tabs
        os.environ["ADMIN_PASSWORD"] = " \t povelitel-polzunov \n "
        assert admin_password() == "povelitel-polzunov"

        # 5. Test password with single quotes and spaces
        os.environ["ADMIN_PASSWORD"] = " 'povelitel-polzunov' "
        assert admin_password() == "povelitel-polzunov"
    finally:
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_admin_login_success():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "  'povelitel-polzunov'  "
        response = Response()
        req = LoginRequest(password="povelitel-polzunov")
        res = await admin_login(req, response, _request())

        assert res == {"status": "ok"}
        cookies = response.headers.getlist("set-cookie")
        assert any(f"{ADMIN_SESSION_COOKIE}=" in cookie for cookie in cookies)
        assert all("povelitel-polzunov" not in cookie for cookie in cookies)
        assert require_admin(_session_token(response)) is None
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_admin_login_failure():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        response = Response()
        req = LoginRequest(password="wrong-password")

        with pytest.raises(HTTPException) as exc_info:
            await admin_login(req, response, _request())

        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid admin password"
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_correct_password_is_not_blocked_by_rate_limit():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        for _ in range(10):
            with pytest.raises(HTTPException):
                await admin_login(LoginRequest(password="wrong"), Response(), _request())

        response = Response()
        result = await admin_login(
            LoginRequest(password="povelitel-polzunov"), response, _request()
        )
        assert result == {"status": "ok"}
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_login_rate_limit_is_per_forwarded_client(monkeypatch):
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        first = _request(headers=[(b"x-real-ip", b"203.0.113.1")])
        second = _request(headers=[(b"x-real-ip", b"203.0.113.2")])

        for _ in range(10):
            with pytest.raises(HTTPException):
                await admin_login(LoginRequest(password="wrong"), Response(), first)

        with pytest.raises(HTTPException) as exc_info:
            await admin_login(LoginRequest(password="wrong"), Response(), first)
        assert exc_info.value.status_code == 429

        with pytest.raises(HTTPException) as exc_info:
            await admin_login(LoginRequest(password="wrong"), Response(), second)
        assert exc_info.value.status_code == 401
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_spoofed_x_forwarded_for_does_not_bypass_login_limit(monkeypatch):
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        for index in range(10):
            req = _request(
                headers=[
                    (b"x-forwarded-for", f"198.51.100.{index + 1}".encode()),
                    (b"x-real-ip", b"203.0.113.50"),
                ]
            )
            with pytest.raises(HTTPException) as exc_info:
                await admin_login(LoginRequest(password="wrong"), Response(), req)
            assert exc_info.value.status_code == 401

        spoofed = _request(
            headers=[
                (b"x-forwarded-for", b"192.0.2.99"),
                (b"x-real-ip", b"203.0.113.50"),
            ]
        )
        with pytest.raises(HTTPException) as exc_info:
            await admin_login(LoginRequest(password="wrong"), Response(), spoofed)
        assert exc_info.value.status_code == 429
        assert list(_login_attempts) == ["203.0.113.50"]
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


def test_login_key_uses_x_real_ip_only_behind_trusted_proxy(monkeypatch):
    req = _request(
        host="10.0.0.7",
        headers=[
            (b"x-real-ip", b"203.0.113.9"),
            (b"x-forwarded-for", b"198.51.100.1"),
        ],
    )

    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    assert _login_key(req) == "203.0.113.9"

    monkeypatch.setenv("TRUST_PROXY_HEADERS", "0")
    assert _login_key(req) == "10.0.0.7"


def test_login_key_falls_back_to_peer_for_invalid_or_absent_real_ip(monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")

    invalid = _request(
        host="10.0.0.7",
        headers=[
            (b"x-real-ip", b"not-an-ip"),
            (b"x-forwarded-for", b"198.51.100.1"),
        ],
    )
    absent = _request(host="10.0.0.7", headers=[(b"x-forwarded-for", b"198.51.100.1")])

    assert _login_key(invalid) == "10.0.0.7"
    assert _login_key(absent) == "10.0.0.7"
    assert _login_key(None) == "unknown"


def test_prune_login_attempts_drops_expired_and_empty_keys():
    _reset_admin_state()
    now = time.monotonic()
    try:
        _login_attempts["expired"] = deque([now - LOGIN_RATE_WINDOW_SECONDS - 1])
        _login_attempts["empty"] = deque()
        _login_attempts["active"] = deque([now])

        admin_module._prune_login_attempts(now)

        assert set(_login_attempts) == {"active"}
    finally:
        _reset_admin_state()


def test_login_limiter_caps_number_of_keys(monkeypatch):
    _reset_admin_state()
    monkeypatch.setattr(admin_module, "MAX_LOGIN_RATE_KEYS", 3)
    try:
        for index in range(10):
            key = f"198.51.100.{index}"
            assert admin_module._is_login_rate_limited(key) is False
            admin_module._record_login_attempt(key)

        assert len(_login_attempts) == 3
        assert "198.51.100.9" in _login_attempts
        assert "198.51.100.0" not in _login_attempts
    finally:
        _reset_admin_state()


@pytest.mark.asyncio
async def test_admin_cookie_uses_secure_only_on_https():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        http_response = Response()
        await admin_login(
            LoginRequest(password="povelitel-polzunov"),
            http_response,
            _request(scheme="http"),
        )
        https_response = Response()
        await admin_login(
            LoginRequest(password="povelitel-polzunov"),
            https_response,
            _request(scheme="https"),
        )

        proxy_response = Response()
        await admin_login(
            LoginRequest(password="povelitel-polzunov"),
            proxy_response,
            _request(scheme="http", headers=[(b"x-forwarded-proto", b"https")]),
        )

        assert "Secure" not in " ".join(http_response.headers.getlist("set-cookie"))
        assert "Secure" in " ".join(https_response.headers.getlist("set-cookie"))
        assert "Secure" in " ".join(proxy_response.headers.getlist("set-cookie"))
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_public_health_does_not_expose_player_counts():
    assert await health_check() == {"status": "ok"}


@pytest.mark.asyncio
async def test_admin_session_reports_cookie_state():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        response = Response()
        await admin_login(LoginRequest(password="povelitel-polzunov"), response, _request())
        token = _session_token(response)

        assert await admin_session(None) == {"authenticated": False, "configured": True}
        assert await admin_session(token) == {"authenticated": True, "configured": True}
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_admin_logout_invalidates_session():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        response = Response()
        await admin_login(LoginRequest(password="povelitel-polzunov"), response, _request())
        token = _session_token(response)

        assert require_admin(token) is None
        await admin_logout(Response(), token)

        with pytest.raises(HTTPException) as exc_info:
            require_admin(token)
        assert exc_info.value.status_code == 401
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_admin_login_rate_limit():
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        for _ in range(10):
            with pytest.raises(HTTPException) as exc_info:
                await admin_login(LoginRequest(password="wrong"), Response(), _request())
            assert exc_info.value.status_code == 401

        with pytest.raises(HTTPException) as exc_info:
            await admin_login(LoginRequest(password="wrong"), Response(), _request())
        assert exc_info.value.status_code == 429
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)
