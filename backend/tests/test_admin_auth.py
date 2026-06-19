# ROLE: Тесты Admin API аутентификации. Проверяет парсинг пароля, очистку пробелов/кавычек и работу login-обработчика.
import os
import pytest
from fastapi import Response, HTTPException
from app.api.admin import admin_password, admin_login, LoginRequest

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
    try:
        os.environ["ADMIN_PASSWORD"] = "  'povelitel-polzunov'  "
        response = Response()
        req = LoginRequest(password="povelitel-polzunov")
        res = await admin_login(req, response)
        
        assert res == {"status": "ok"}
        cookies = response.headers.getlist("set-cookie")
        assert any("admin_token=povelitel-polzunov" in c for c in cookies)
    finally:
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)

@pytest.mark.asyncio
async def test_admin_login_failure():
    original_env = os.environ.get("ADMIN_PASSWORD")
    try:
        os.environ["ADMIN_PASSWORD"] = "povelitel-polzunov"
        response = Response()
        req = LoginRequest(password="wrong-password")
        
        with pytest.raises(HTTPException) as exc_info:
            await admin_login(req, response)
        
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid admin password"
    finally:
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)
