# ROLE: Test isolation: pinned config via CONFIG_PATH and clean module-level runtime state.
# Does not change production behavior or game logic.

import shutil
from pathlib import Path

import pytest

from app.api import admin as admin_module
from app.api import websocket as websocket_module

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
PINNED_CONFIG_PATH = FIXTURES_DIR / "config_parity.json"


def _cancel_task(task) -> None:
    """Cancel a task-like object without assuming a running event loop."""
    cancel = getattr(task, "cancel", None)
    if not callable(cancel):
        return
    try:
        cancel()
    except Exception:
        # Fake task objects in tests may not be cancellable outside their loop.
        # Isolation must not fail because of that.
        pass


def clear_runtime_globals() -> None:
    """Drop cross-test runtime state and cancel tasks that outlive a test."""
    for connection in list(websocket_module.active_connections.values()):
        if isinstance(connection, dict):
            _cancel_task(connection.get("task"))
    for task in list(websocket_module.pending_disconnects.values()):
        _cancel_task(task)

    websocket_module.active_connections.clear()
    websocket_module.pending_disconnects.clear()
    admin_module._admin_sessions.clear()
    admin_module._login_attempts.clear()


@pytest.fixture
def reset_runtime_globals():
    """Expose the shared reset helper for isolation regression tests."""
    return clear_runtime_globals


@pytest.fixture(autouse=True)
def isolated_test_runtime(tmp_path, monkeypatch):
    """Run every test against a private copy of the pinned parity config."""
    config_path = tmp_path / "config.json"
    shutil.copyfile(PINNED_CONFIG_PATH, config_path)
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    clear_runtime_globals()

    yield

    clear_runtime_globals()
