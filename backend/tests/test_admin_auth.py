# ROLE: Тесты Admin API аутентификации. Проверяет очистку пароля и session-cookie.
import os
import pytest
from fastapi import Response, HTTPException
from starlette.requests import Request
from app.api.admin import (
    ADMIN_SESSION_COOKIE,
    LoginRequest,
    _admin_sessions,
    _login_attempts,
    admin_login,
    admin_logout,
    admin_password,
    admin_session,
    require_admin,
)


def _reset_admin_state():
    _admin_sessions.clear()
    _login_attempts.clear()


def _request(host: str = "test", scheme: str = "http") -> Request:
    return Request(
        {
            "type": "http",
            "scheme": scheme,
            "server": ("test", 80),
            "path": "/admin/login",
            "client": (host, 123),
            "headers": [],
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

        assert "Secure" not in " ".join(http_response.headers.getlist("set-cookie"))
        assert "Secure" in " ".join(https_response.headers.getlist("set-cookie"))
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


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
