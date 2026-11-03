# ROLE: Регрессии split World → ConfigStore/InputRouter/SnapshotService: proxies, wiring и monkeypatch-точки.
# Не дублирует транзакционные config-тесты; проверяет только сохранение публичного API World.

import pytest

from game_config import GameConfig
from app.engine.state import World


def test_config_is_owned_by_config_store():
    world = World()

    assert world.config_store.world is world
    assert world.config is world.config_store.config
    assert world.config_file_path == world.config_store.config_file_path
    assert world.growth_segment_cost_func is world.config_store.growth_segment_cost_func
    assert world._growth_formula_error_logged is False
    assert callable(world._compiled_growth_cost)


def test_config_file_path_setter_updates_store(tmp_path):
    world = World()
    target = tmp_path / "moved-config.json"

    world.config_file_path = target

    assert world.config_file_path == target
    assert world.config_store.config_file_path == target


def test_config_and_error_flag_assignments_proxy_to_store():
    world = World()
    new_config = GameConfig()

    world.config = new_config
    world._growth_formula_error_logged = True
    world.add_player("player-1")

    assert world.config is new_config
    assert world.config_store.config is new_config
    assert world.config_store._growth_formula_error_logged is True
    assert world.players["player-1"].config is world.config


def test_input_router_respawn_reaches_food_manager():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]
    player.is_dead = True

    world.update_direction("player-1", "RESPAWN")

    assert player.is_dead is False
    assert player.body_len == player.config.snake.start_length


def test_input_router_is_wired_and_preserves_action_semantics():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]

    assert world.input_router.world is world

    world.update_direction("player-1", "LEFT_DOWN")
    assert player.turn == -1
    assert player.steered_by_mouse is False

    world.update_direction("player-1", "LEFT_UP")
    assert player.turn == 0

    world.update_direction("player-1", "TURN:0.25")
    assert player.turn == pytest.approx(0.25)
    assert player.steered_by_mouse is True

    world.update_direction("player-1", "SPACE_DOWN")
    assert player.accelerating is True

    world.update_direction("player-1", "CONTROL_MODE:keyboard")
    assert player.turn == 0
    assert player.current_turn == 0.0
    assert player.steered_by_mouse is False

    world.reset_player_input("player-1")
    assert player.turn == 0
    assert player.current_turn == 0.0
    assert player.accelerating is False


def test_snapshot_service_is_wired_and_updates_visibility():
    world = World()
    world.add_player("player-1")

    assert world.snapshot_service.world is world

    world.set_client_visibility("player-1", {"player-1"})
    assert world.client_visibility["player-1"] == {"player-1"}

    frame = world.get_full_state("player-1")
    assert frame.server_tick == world.server_tick


def test_update_config_routes_apply_through_world(monkeypatch):
    world = World()
    real_apply = world._apply_live_config
    calls = []

    def recording_apply(*args):
        calls.append(args)
        return real_apply(*args)

    monkeypatch.setattr(world, "_apply_live_config", recording_apply)
    monkeypatch.setattr(world, "_backup_config_file", lambda: False)
    monkeypatch.setattr(world, "_save_config_to_disk", lambda config=None: None)

    result = world.update_config({"world": {"target_food_count": 78}})

    assert len(calls) == 1
    assert result["world"]["target_food_count"] == 78


def test_legacy_config_wrappers_are_callable():
    world = World()
    original = world.config

    assert world._load_config_from_disk() is None
    assert world._update_compiled_formulas() is None
    assert isinstance(world._safe_growth_cost(10.0, 3.0), float)
    assert world.config is original


def test_update_config_routes_through_world_monkeypatch_points(monkeypatch):
    world = World()
    saved = []

    monkeypatch.setattr(world, "_backup_config_file", lambda: False)
    monkeypatch.setattr(world, "_save_config_to_disk", lambda config=None: saved.append(config))

    result = world.update_config({"world": {"target_food_count": 77}})

    assert result == world.config_store.get_config()
    assert result["world"]["target_food_count"] == 77
    assert world._config_updated_this_tick is True
    assert len(saved) == 1
