# ROLE: Audit-log tests for admin login/config/restart. Verifies JSON fields,
# client IP source and that passwords/session tokens never reach the log.
import json
import logging
import os
import types

import pytest
from fastapi import HTTPException, Response
from starlette.requests import Request

from app.api import admin as admin_module
from app.api.admin import (
    ADMIN_SESSION_COOKIE,
    LoginRequest,
    _admin_sessions,
    _login_attempts,
    admin_login,
    admin_restart_game,
    patch_admin_config,
)
from app.api.config_schema import AdminConfigPatch
from app.api.websocket import active_connections, pending_disconnects


class FakeWorld:
    def __init__(self, error=None):
        self.error = error
        self.reset_called = False
        self.draining = False
        self.applied = None

    def update_config(self, patch):
        if self.error is not None:
            raise self.error
        self.applied = patch
        return {"status": "updated"}

    def reset_state(self):
        self.reset_called = True


def _request(world=None, host: str = "10.0.0.7", headers=None) -> Request:
    scope = {
        "type": "http",
        "scheme": "http",
        "server": ("test", 80),
        "path": "/admin",
        "client": (host, 123),
        "headers": headers or [],
        "query_string": b"",
        "root_path": "",
    }
    if world is not None:
        scope["app"] = types.SimpleNamespace(
            state=types.SimpleNamespace(world=world),
        )
    return Request(scope)


def _trusted_request(world=None, ip: str = "198.51.100.20") -> Request:
    return _request(world=world, headers=[(b"x-real-ip", ip.encode())])


def _audit_records(caplog) -> list[dict]:
    records = []
    for record in caplog.records:
        if record.name != admin_module.logger.name:
            continue
        message = record.getMessage()
        if not message.startswith("{"):
            continue
        payload = json.loads(message)
        if {"timestamp", "event", "ip"} <= payload.keys():
            records.append(payload)
    return records


def _only_audit(caplog, event: str) -> dict:
    matching = [record for record in _audit_records(caplog) if record["event"] == event]
    assert len(matching) == 1
    return matching[0]


def _session_token(response: Response) -> str:
    for header in response.headers.getlist("set-cookie"):
        if header.startswith(f"{ADMIN_SESSION_COOKIE}="):
            return header.split(";", 1)[0].split("=", 1)[1]
    raise AssertionError("Admin session cookie was not set")


def _reset_admin_state():
    _admin_sessions.clear()
    _login_attempts.clear()


@pytest.mark.asyncio
async def test_login_audit_records_results_without_secrets(caplog, monkeypatch):
    original_env = os.environ.get("ADMIN_PASSWORD")
    _reset_admin_state()
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    caplog.set_level(logging.INFO, logger="app.api.admin")
    try:
        os.environ["ADMIN_PASSWORD"] = "super-secret-password"
        request = _trusted_request(ip="203.0.113.30")

        response = Response()
        await admin_login(LoginRequest(password="super-secret-password"), response, request)
        token = _session_token(response)

        for _ in range(10):
            with pytest.raises(HTTPException) as exc_info:
                await admin_login(LoginRequest(password="wrong-password"), Response(), request)
            assert exc_info.value.status_code == 401

        with pytest.raises(HTTPException) as exc_info:
            await admin_login(LoginRequest(password="wrong-password"), Response(), request)
        assert exc_info.value.status_code == 429

        records = [record for record in _audit_records(caplog) if record["event"] == "login"]
        assert [record["result"] for record in records] == [
            "success",
            *["failure"] * 10,
            "rate_limited",
        ]
        assert {record["ip"] for record in records} == {"203.0.113.30"}
        assert all(record["timestamp"] for record in records)
        assert "super-secret-password" not in caplog.text
        assert "wrong-password" not in caplog.text
        assert token not in caplog.text
    finally:
        _reset_admin_state()
        if original_env is not None:
            os.environ["ADMIN_PASSWORD"] = original_env
        else:
            os.environ.pop("ADMIN_PASSWORD", None)


@pytest.mark.asyncio
async def test_config_audit_logs_result_and_top_level_keys_only(caplog, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    caplog.set_level(logging.INFO, logger="app.api.admin")
    patch = AdminConfigPatch.model_validate(
        {"world": {"target_food_count": 123}, "snake": {"start_length": 7}}
    )
    world = FakeWorld()

    result = await patch_admin_config(patch, _trusted_request(world=world))

    assert result == {"status": "updated"}
    record = _only_audit(caplog, "config")
    assert record["result"] == "success"
    assert record["ip"] == "198.51.100.20"
    assert record["keys"] == ["snake", "world"]
    serialized = json.dumps(record)
    assert "target_food_count" not in serialized
    assert "start_length" not in serialized
    assert "123" not in serialized


@pytest.mark.asyncio
async def test_config_audit_logs_failure(caplog, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    caplog.set_level(logging.INFO, logger="app.api.admin")
    patch = AdminConfigPatch.model_validate({"world": {"width": 500}})
    world = FakeWorld(error=ValueError("world.width is invalid"))

    with pytest.raises(HTTPException) as exc_info:
        await patch_admin_config(patch, _trusted_request(world=world))

    assert exc_info.value.status_code == 400
    record = _only_audit(caplog, "config")
    assert record["result"] == "failure"
    assert record["keys"] == ["world"]
    assert "world.width is invalid" not in caplog.text


@pytest.mark.asyncio
async def test_restart_audit_logs_success(caplog, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    caplog.set_level(logging.INFO, logger="app.api.admin")
    active_connections.clear()
    pending_disconnects.clear()
    world = FakeWorld()

    result = await admin_restart_game(_trusted_request(world=world))

    assert result["status"] == "ok"
    assert world.reset_called is True
    record = _only_audit(caplog, "restart")
    assert record["result"] == "success"
    assert record["ip"] == "198.51.100.20"


@pytest.mark.asyncio
async def test_restart_audit_logs_failure(caplog, monkeypatch):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "1")
    caplog.set_level(logging.INFO, logger="app.api.admin")
    active_connections.clear()
    pending_disconnects.clear()
    world = FakeWorld()

    async def fail(_message):
        raise RuntimeError("restart aborted")

    monkeypatch.setattr(admin_module, "_queue_restart_message", fail)

    with pytest.raises(RuntimeError, match="restart aborted"):
        await admin_restart_game(_trusted_request(world=world))

    assert world.reset_called is False
    assert world.draining is False
    record = _only_audit(caplog, "restart")
    assert record["result"] == "failure"
