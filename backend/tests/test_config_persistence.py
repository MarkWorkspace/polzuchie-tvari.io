# ROLE: Тесты транзакционного сохранения runtime-конфигурации: backup, rollback, bind mount и 503.
import errno
import json
import os

import pytest
from fastapi.testclient import TestClient

from app.api import admin as admin_module
from app.engine.entities import BlackHole, Portal
from app.engine.state import World
import server


def _world(tmp_path, monkeypatch):
    config_path = tmp_path / "config.json"
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    world = World()
    return world, config_path


@pytest.fixture
def admin_client(monkeypatch):
    admin_module._admin_sessions.clear()
    admin_module._login_attempts.clear()
    monkeypatch.setenv("ADMIN_PASSWORD", "persistence-test")
    with TestClient(server.app) as client:
        response = client.post("/admin/login", json={"password": "persistence-test"})
        assert response.status_code == 200
        yield client
    admin_module._admin_sessions.clear()
    admin_module._login_attempts.clear()


def test_update_config_persists_and_keeps_valid_json(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)

    world.update_config({"world": {"target_food_count": 123}})

    assert world.get_config()["world"]["target_food_count"] == 123
    assert json.loads(config_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 123
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_update_config_backs_up_previous_version(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)

    world.update_config({"world": {"target_food_count": 111}})
    world.update_config({"world": {"target_food_count": 222}})

    backup_path = tmp_path / "config.json.bak"
    assert json.loads(config_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 222
    assert json.loads(backup_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 111


def test_save_falls_back_to_in_place_write_for_single_file_mount(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)

    def fail_replace(source, destination):
        raise OSError(errno.EXDEV, "Invalid cross-device link", source, destination)

    monkeypatch.setattr(os, "replace", fail_replace)
    world.update_config({"world": {"target_food_count": 321}})

    assert json.loads(config_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 321
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_failed_save_does_not_mutate_live_config(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    before = world.get_config()
    before_bytes = config_path.read_bytes()

    def fail_replace(source, destination):
        raise OSError(errno.EACCES, "Permission denied", source, destination)

    monkeypatch.setattr(os, "replace", fail_replace)

    with pytest.raises(OSError):
        world.update_config({"world": {"target_food_count": 777}})

    assert world.get_config() == before
    assert config_path.read_bytes() == before_bytes
    assert not list(tmp_path.glob(".config.json.*.tmp"))
    backup_path = tmp_path / "config.json.bak"
    assert backup_path.read_bytes() == before_bytes


def test_rollback_failure_does_not_mask_original_save_error(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    before_bytes = config_path.read_bytes()

    def fail_replace(source, destination):
        raise OSError(errno.EACCES, "Permission denied", source, destination)

    def fail_rollback(old_config, pending_growth_snapshot):
        raise RuntimeError("rollback failed")

    monkeypatch.setattr(os, "replace", fail_replace)
    monkeypatch.setattr(world, "_restore_live_config", fail_rollback)

    with pytest.raises(OSError) as exc_info:
        world.update_config({"world": {"target_food_count": 777}})

    assert exc_info.value.errno == errno.EACCES
    assert config_path.read_bytes() == before_bytes


def test_rollback_file_rewrite_error_does_not_mask_original_save_error(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    before_bytes = config_path.read_bytes()
    real_save = world._save_config_to_disk
    save_calls = []

    def fail_rollback_rewrite(config=None):
        save_calls.append(config)
        if len(save_calls) == 1:
            return real_save(config)
        raise ValueError("rollback serialization failed")

    def fail_replace(source, destination):
        raise OSError(errno.EACCES, "Permission denied", source, destination)

    monkeypatch.setattr(world, "_save_config_to_disk", fail_rollback_rewrite)
    monkeypatch.setattr(world, "_backup_config_file", lambda: False)
    monkeypatch.setattr(os, "replace", fail_replace)

    with pytest.raises(OSError) as exc_info:
        world.update_config({"world": {"target_food_count": 777}})

    assert exc_info.value.errno == errno.EACCES
    assert len(save_calls) == 2
    assert config_path.read_bytes() == before_bytes


def test_failed_apply_rolls_back_live_config_and_leaves_disk_alone(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    world.add_player("player-1")
    player = world.players["player-1"]
    old_config = world.config
    before = world.get_config()
    before_bytes = config_path.read_bytes()

    def fail_apply():
        raise RuntimeError("food apply failed")

    monkeypatch.setattr(world.food_manager, "apply_config", fail_apply)

    with pytest.raises(RuntimeError, match="food apply failed"):
        world.update_config({"world": {"target_food_count": 777}})

    assert world.config is old_config
    assert world.get_config() == before
    assert player.config is world.config
    assert config_path.read_bytes() == before_bytes
    assert not (tmp_path / "config.json.bak").exists()
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_failed_apply_restores_grid_dimensions(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    world.add_player("player-1")
    player = world.players["player-1"]
    before = world.get_config()
    before_bytes = config_path.read_bytes()
    before_grid = (
        world.grid_width,
        world.grid_height,
        world.target_food_count,
        world._grid_width_cells,
        world._grid_height_cells,
    )

    def fail_apply():
        raise RuntimeError("late apply failed")

    monkeypatch.setattr(world.food_manager, "apply_config", fail_apply)

    with pytest.raises(RuntimeError, match="late apply failed"):
        world.update_config({"world": {"width": 200, "height": 150, "target_food_count": 321}})

    assert world.get_config() == before
    assert player.config is world.config
    assert (
        world.grid_width,
        world.grid_height,
        world.target_food_count,
        world._grid_width_cells,
        world._grid_height_cells,
    ) == before_grid
    assert world.spatial_grid == {}
    assert config_path.read_bytes() == before_bytes


def test_failed_apply_restores_pending_growth_and_formula(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    world.add_player("player-1")
    world.add_player("player-2")
    for player_id, score in (("player-1", 100.0), ("player-2", 250.0)):
        player = world.players[player_id]
        player.score = score
        world.align_player_growth(player)

    before = world.get_config()
    before_bytes = config_path.read_bytes()
    before_formula = world.config.snake.growth_score_per_segment
    before_cost = world.growth_segment_cost_func(123.0, 12.0)
    before_pending = {
        player_id: player.pending_growth for player_id, player in world.players.items()
    }

    def fail_apply():
        raise RuntimeError("food apply failed")

    monkeypatch.setattr(world.food_manager, "apply_config", fail_apply)

    with pytest.raises(RuntimeError, match="food apply failed"):
        world.update_config(
            {
                "snake": {
                    "growth_score_per_segment": "2 + 0.01 * l",
                    "start_score": 50,
                }
            }
        )

    assert world.get_config() == before
    assert world.config.snake.growth_score_per_segment == before_formula
    assert world.growth_segment_cost_func(123.0, 12.0) == pytest.approx(before_cost)
    assert {
        player_id: player.pending_growth for player_id, player in world.players.items()
    } == before_pending
    assert config_path.read_bytes() == before_bytes


def test_failed_save_restores_derived_radii(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    food = next(iter(world.food_manager.foods.values()))
    old_food = (food.id, food.x, food.y, food.radius)
    portal = Portal("portal_test", 10.0, 20.0, 30.0, 40.0, 2.5, "#3b82f6")
    portal.current_scale = 1.0
    portal.state = "active"
    black_hole = BlackHole("bh_test", 15.0, 25.0, 16.0, 1.2)
    black_hole.current_scale = 1.0
    black_hole.state = "active"
    world.portal_manager.slots = [portal, None]
    world.bh_manager.slots = [black_hole, None]
    old_portal = (
        portal.id,
        portal.x1,
        portal.y1,
        portal.x2,
        portal.y2,
        portal.radius,
    )
    old_black_hole = (
        black_hole.id,
        black_hole.x,
        black_hole.y,
        black_hole.pull_radius,
        black_hole.kill_radius,
    )
    before = world.get_config()
    before_bytes = config_path.read_bytes()

    def fail_replace(source, destination):
        raise OSError(errno.EACCES, "Permission denied", source, destination)

    monkeypatch.setattr(os, "replace", fail_replace)

    with pytest.raises(OSError):
        world.update_config(
            {
                "food": {"base_radius": 0.3, "radius_value_scale": 0.2},
                "world": {
                    "portals_radius": 4.0,
                    "black_holes_pull_radius": 20.0,
                    "black_holes_kill_radius": 2.0,
                },
            }
        )

    assert world.get_config() == before
    assert (food.id, food.x, food.y) == old_food[:3]
    assert food.radius == pytest.approx(old_food[3])
    assert (portal.id, portal.x1, portal.y1, portal.x2, portal.y2) == old_portal[:5]
    assert portal.radius == pytest.approx(old_portal[5])
    assert (
        black_hole.id,
        black_hole.x,
        black_hole.y,
        black_hole.pull_radius,
        black_hole.kill_radius,
    ) == old_black_hole
    assert config_path.read_bytes() == before_bytes


def test_failed_apply_restores_slot_counts_without_reroll(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    old_portal_count = world.config.world.portals_count
    old_black_hole_count = world.config.world.black_holes_count
    before = world.get_config()
    real_sync = world.bot_manager.sync
    sync_calls = []

    def fail_sync_once():
        if not sync_calls:
            sync_calls.append(True)
            raise RuntimeError("bot sync failed")
        return real_sync()

    monkeypatch.setattr(world.bot_manager, "sync", fail_sync_once)

    with pytest.raises(RuntimeError, match="bot sync failed"):
        world.update_config({"world": {"portals_count": 5, "black_holes_count": 1}})

    assert world.get_config() == before
    assert len(world.portal_manager.slots) == old_portal_count
    assert len(world.bh_manager.slots) == old_black_hole_count


def test_backup_restored_after_partial_inplace_write(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)
    world.update_config({"world": {"target_food_count": 111}})
    before = world.get_config()
    before_bytes = config_path.read_bytes()
    real_dump = json.dump

    def fail_replace(source, destination):
        raise OSError(errno.EXDEV, "Invalid cross-device link", source, destination)

    def fail_inplace_dump(payload, file, **kwargs):
        name = file.name
        if isinstance(name, str) and os.path.abspath(name) == os.path.abspath(config_path):
            file.write('{"partial":')
            raise OSError(errno.ENOSPC, "No space left on device")
        return real_dump(payload, file, **kwargs)

    monkeypatch.setattr(os, "replace", fail_replace)
    monkeypatch.setattr(json, "dump", fail_inplace_dump)

    with pytest.raises(OSError):
        world.update_config({"world": {"target_food_count": 222}})

    assert world.get_config() == before
    assert config_path.read_bytes() == before_bytes
    assert (
        json.loads((tmp_path / "config.json.bak").read_text(encoding="utf-8"))["world"][
            "target_food_count"
        ]
        == 111
    )
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_admin_config_returns_503_when_apply_raises(admin_client, tmp_path, monkeypatch):
    world = server.app.state.world
    config_path = tmp_path / "config.json"
    before_bytes = config_path.read_bytes()

    def fail_update(patch):
        raise RuntimeError("live apply failed")

    monkeypatch.setattr(world, "update_config", fail_update)

    response = admin_client.patch("/admin/config", json={"world": {"target_food_count": 123}})

    assert response.status_code == 503
    assert response.json()["detail"] == "Configuration was validated but could not be applied"
    assert config_path.read_bytes() == before_bytes


def test_admin_config_keeps_value_error_as_400(admin_client, tmp_path, monkeypatch):
    world = server.app.state.world
    config_path = tmp_path / "config.json"
    before_bytes = config_path.read_bytes()

    def fail_update(patch):
        raise ValueError("world.width must be between 20 and 10000")

    monkeypatch.setattr(world, "update_config", fail_update)

    response = admin_client.patch("/admin/config", json={"world": {"width": 100}})

    assert response.status_code == 400
    assert "world.width" in response.json()["detail"]
    assert config_path.read_bytes() == before_bytes
