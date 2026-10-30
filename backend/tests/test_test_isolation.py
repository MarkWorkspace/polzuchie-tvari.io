# ROLE: Regression tests for test isolation: pinned parity config and clean module globals.
# Does not test gameplay, serialization or production config behavior.

import asyncio
import copy
import hashlib
import json
import os
from collections import deque
from pathlib import Path

import pytest

from app.api import admin as admin_module
from app.api import websocket as websocket_module
from app.engine.state import World
from tests.frame_scenario import PINNED_CONFIG_PATH, build_deterministic_world

PINNED_CONFIG = json.loads(PINNED_CONFIG_PATH.read_text(encoding="utf-8"))
REPO_CONFIG_PATH = Path(__file__).resolve().parents[1] / "config.json"


class _FakeTask:
    def __init__(self):
        self.cancelled = False

    def cancel(self):
        self.cancelled = True


def _assert_config_matches_pinned(world: World) -> None:
    actual = world.get_config()
    for section, values in PINNED_CONFIG.items():
        for key, expected in values.items():
            assert actual[section][key] == expected, f"{section}.{key} drifted from pinned config"


def _file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_config_path_is_a_private_pinned_copy(tmp_path):
    assert Path(os.environ["CONFIG_PATH"]) == tmp_path / "config.json"
    assert json.loads((tmp_path / "config.json").read_text(encoding="utf-8")) == PINNED_CONFIG


def test_every_test_world_uses_private_pinned_copy(tmp_path):
    world = World()

    assert Path(world.config_file_path) == tmp_path / "config.json"
    assert Path(world.config_file_path) != REPO_CONFIG_PATH
    _assert_config_matches_pinned(world)


def test_deterministic_world_ignores_changed_runtime_config(tmp_path, monkeypatch):
    mutated = copy.deepcopy(PINNED_CONFIG)
    mutated["world"]["width"] = 40
    mutated["world"]["target_food_count"] = 10
    mutated["snake"]["start_length"] = 3
    mutated["food"]["types"][0]["value"] = 999
    changed_path = tmp_path / "changed_runtime_config.json"
    changed_path.write_text(json.dumps(mutated), encoding="utf-8")
    monkeypatch.setenv("CONFIG_PATH", str(changed_path))

    # Control: World() itself still honors CONFIG_PATH, so the mutation is real.
    control = World()
    assert control.config.world.width == 40
    assert control.config.snake.start_length == 3

    world = build_deterministic_world()

    assert Path(world.config_file_path) == changed_path
    assert Path(world.config_file_path) != REPO_CONFIG_PATH
    assert Path(world.config_file_path) != PINNED_CONFIG_PATH
    assert world.config.world.width == PINNED_CONFIG["world"]["width"]
    assert world.config.snake.start_length == PINNED_CONFIG["snake"]["start_length"]
    assert world.config.food.types[0].value == PINNED_CONFIG["food"]["types"][0]["value"]
    _assert_config_matches_pinned(world)


def test_update_config_on_parity_world_does_not_touch_pinned_fixture(tmp_path):
    pinned_before = _file_digest(PINNED_CONFIG_PATH)
    world = build_deterministic_world()

    assert Path(world.config_file_path) == tmp_path / "config.json"
    assert Path(world.config_file_path) != PINNED_CONFIG_PATH
    assert Path(world.config_file_path) != REPO_CONFIG_PATH

    world.update_config({"world": {"target_food_count": 123}})

    assert _file_digest(PINNED_CONFIG_PATH) == pinned_before
    saved = json.loads((tmp_path / "config.json").read_text(encoding="utf-8"))
    assert saved["world"]["target_food_count"] == 123


def test_runtime_globals_are_clean_at_test_start():
    assert websocket_module.active_connections == {}
    assert websocket_module.pending_disconnects == {}
    assert admin_module._admin_sessions == {}
    assert admin_module._login_attempts == {}


def test_runtime_globals_reset_cancels_tasks_and_clears_state(reset_runtime_globals):
    active_task = _FakeTask()
    pending_task = _FakeTask()
    websocket_module.active_connections["ghost"] = {"task": active_task}
    websocket_module.pending_disconnects["ghost"] = pending_task
    admin_module._admin_sessions["token"] = 1.0
    admin_module._login_attempts["127.0.0.1"] = deque([1.0])

    reset_runtime_globals()

    assert active_task.cancelled is True
    assert pending_task.cancelled is True
    assert websocket_module.active_connections == {}
    assert websocket_module.pending_disconnects == {}
    assert admin_module._admin_sessions == {}
    assert admin_module._login_attempts == {}


@pytest.mark.asyncio
async def test_runtime_globals_reset_cancels_real_asyncio_task(reset_runtime_globals):
    task = asyncio.create_task(asyncio.sleep(3600))
    websocket_module.pending_disconnects["ghost"] = task

    reset_runtime_globals()

    with pytest.raises(asyncio.CancelledError):
        await task
