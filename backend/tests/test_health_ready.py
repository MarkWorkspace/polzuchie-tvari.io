# ROLE: Liveness/readiness и tick-метрики: /health всегда 200, /ready 503 при stale tick,
# admin health и game_loop counters. Не тестирует игровую логику тика.

import asyncio
import contextlib
import time
import types

import pytest
from fastapi.testclient import TestClient

import server
from app.engine.state import World


async def _idle_game_loop(world):
    await asyncio.Event().wait()


@pytest.fixture
def idle_client(monkeypatch):
    """TestClient with the real lifespan but a frozen game loop."""
    monkeypatch.setattr(server, "game_loop", _idle_game_loop)
    with TestClient(server.app) as client:
        yield client


async def _cancel(task):
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


async def _wait_until(predicate, limit=1.0):
    deadline = time.monotonic() + limit
    while not predicate():
        if time.monotonic() >= deadline:
            raise AssertionError("condition was not met before timeout")
        await asyncio.sleep(0.005)


def _fake_loop_world(fail=False):
    world = types.SimpleNamespace(
        input_queue=[],
        bot_manager=types.SimpleNamespace(update=lambda: None),
        tick_interval=0.01,
        tick_count=0,
        tick_duration_ms=0.0,
        tick_errors=0,
        last_tick_monotonic=0.0,
    )

    def tick():
        if fail:
            raise RuntimeError("tick failed")

    world.tick = tick
    return world


def _stale(world, seconds=10.0):
    world.last_tick_monotonic = time.monotonic() - seconds


def test_health_stays_liveness_when_tick_is_stale(idle_client):
    _stale(idle_client.app.state.world, 60.0)

    for path in ("/health", "/ws/health"):
        response = idle_client.get(path)
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_ready_is_fresh_then_stale_with_tick_metrics(idle_client):
    world = idle_client.app.state.world
    world.tick_count = 7
    world.tick_duration_ms = 1.25
    world.tick_errors = 2

    fresh = idle_client.get("/ready")
    assert fresh.status_code == 200
    fresh_body = fresh.json()
    assert fresh_body["status"] == "ready"
    assert fresh_body["tick_age_ms"] >= 0.0
    assert fresh_body["tick_count"] == 7
    assert fresh_body["tick_duration_ms"] == 1.25
    assert fresh_body["tick_errors"] == 2

    stale_after = max(2.0, world.tick_interval * 5)
    _stale(world, stale_after + 1.0)

    stale = idle_client.get("/ready")
    assert stale.status_code == 503
    stale_body = stale.json()
    assert stale_body["status"] == "stale"
    assert stale_body["tick_age_ms"] > stale_after * 1000.0
    assert stale_body["tick_count"] == 7
    assert stale_body["tick_duration_ms"] == 1.25
    assert stale_body["tick_errors"] == 2


def test_ws_ready_has_parity_with_ready(idle_client):
    world = idle_client.app.state.world
    world.tick_count = 3
    world.tick_errors = 1
    _stale(world, 60.0)

    ready = idle_client.get("/ready")
    ws_ready = idle_client.get("/ws/ready")

    assert ready.status_code == ws_ready.status_code == 503
    assert ready.json()["status"] == ws_ready.json()["status"] == "stale"
    for key in ("tick_age_ms", "tick_count", "tick_duration_ms", "tick_errors"):
        assert key in ready.json()
        assert key in ws_ready.json()
    assert ready.json()["tick_count"] == ws_ready.json()["tick_count"] == 3
    assert ready.json()["tick_errors"] == ws_ready.json()["tick_errors"] == 1


def test_admin_health_includes_tick_metrics(idle_client, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "health-ready-test")
    login = idle_client.post("/admin/login", json={"password": "health-ready-test"})
    assert login.status_code == 200

    world = idle_client.app.state.world
    world.tick_count = 5
    world.tick_duration_ms = 2.5
    world.tick_errors = 4

    response = idle_client.get("/admin/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["players"] == 0
    assert isinstance(body["bots"], int)
    assert body["bots"] >= 0
    assert body["spectators"] == 0
    assert body["tick_count"] == 5
    assert body["tick_duration_ms"] == 2.5
    assert body["tick_errors"] == 4
    assert body["tick_age_ms"] >= 0.0


def test_reset_state_keeps_tick_metrics():
    world = World()
    world.tick_count = 11
    world.tick_duration_ms = 3.5
    world.tick_errors = 2
    world.last_tick_monotonic = time.monotonic() - 1.0

    world.reset_state()

    assert world.tick_count == 11
    assert world.tick_duration_ms == 3.5
    assert world.tick_errors == 2
    assert world.last_tick_monotonic < time.monotonic()
    health = world.get_health_info()
    assert health["tick_count"] == 11
    assert health["tick_duration_ms"] == 3.5
    assert health["tick_errors"] == 2


@pytest.mark.asyncio
async def test_game_loop_updates_tick_metrics(monkeypatch):
    monkeypatch.setattr(server, "active_connections", {})
    world = _fake_loop_world()
    task = asyncio.create_task(server.game_loop(world))
    try:
        await _wait_until(lambda: world.tick_count >= 2)
    finally:
        await _cancel(task)

    assert world.tick_count >= 2
    assert world.tick_errors == 0
    assert world.tick_duration_ms >= 0.0
    assert world.last_tick_monotonic > 0.0


@pytest.mark.asyncio
async def test_game_loop_counts_errors_without_refreshing_heartbeat(monkeypatch):
    monkeypatch.setattr(server, "active_connections", {})
    world = _fake_loop_world(fail=True)
    task = asyncio.create_task(server.game_loop(world))
    try:
        await _wait_until(lambda: world.tick_errors >= 2)
    finally:
        await _cancel(task)

    assert world.tick_count == 0
    assert world.tick_errors >= 2
    assert world.last_tick_monotonic == 0.0
