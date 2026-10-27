# ROLE: Route-level tests for public health and admin session endpoints.
from fastapi.testclient import TestClient

from app.api.admin import _admin_sessions, _login_attempts
import server


def test_admin_route_session_flow(monkeypatch):
    _admin_sessions.clear()
    _login_attempts.clear()
    monkeypatch.setenv("ADMIN_PASSWORD", "route-test")

    with TestClient(server.app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {"status": "ok"}

        session = client.get("/admin/session")
        assert session.status_code == 200
        assert session.json() == {"authenticated": False, "configured": True}

        assert client.get("/admin/health").status_code == 401
        assert client.get("/admin/config").status_code == 401

        wrong = client.post("/admin/login", json={"password": "wrong"})
        assert wrong.status_code == 401

        login = client.post("/admin/login", json={"password": "route-test"})
        assert login.status_code == 200
        assert login.json() == {"status": "ok"}

        session = client.get("/admin/session")
        assert session.json()["authenticated"] is True

        admin_health = client.get("/admin/health")
        assert admin_health.status_code == 200
        assert admin_health.json()["status"] == "ok"

        config = client.get("/admin/config")
        assert config.status_code == 200
        assert "world" in config.json()

        logout = client.post("/admin/logout")
        assert logout.status_code == 200
        assert client.get("/admin/session").json()["authenticated"] is False
