# ROLE: Live-config regression tests: existing players, bots and world entities see the new config after update.
import math

import pytest

from app.engine.entities import BlackHole, Portal
from app.engine.state import World


def test_live_base_head_radius_rebinds_existing_player():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]
    old_config = player.config

    world.update_config({"snake": {"base_head_radius": 0.6}})

    assert player.config is world.config
    assert player.config is not old_config
    assert player.head_radius == pytest.approx(0.6)


def test_live_boost_min_score_applies_to_existing_player():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]
    player.accelerating = True
    player.score = 10

    assert player.is_accelerating_valid is False

    world.update_config({"boost": {"min_score": 5}})

    assert player.config is world.config
    assert player.is_accelerating_valid is True

    world.update_config({"boost": {"min_score": 20}})

    assert player.is_accelerating_valid is False


def test_live_start_length_applies_on_next_respawn():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]
    old_length = player.body_len

    world.update_config({"snake": {"start_length": 14}})

    assert player.config.snake.start_length == 14
    assert player.body_len == old_length
    player.respawn(10.0, 10.0)
    assert player.body_len == 14
    assert player.length == 14


def test_live_start_score_realigns_existing_player_growth():
    world = World()
    world.add_player("player-1")
    player = world.players["player-1"]
    player.score = 100
    player.pending_growth = 0.0

    world.update_config({"snake": {"start_score": 50}})

    assert player.config is world.config
    assert player.body_len == 9
    assert player.pending_growth > 0.0


def test_live_config_rebinds_bot_players():
    world = World()
    world.config.bots.enabled = 1
    world.config.bots.count = 1
    world.bot_manager.start()
    bot = world.players["bot-1"]

    world.update_config({"snake": {"base_head_radius": 0.8}})

    assert world.players["bot-1"] is bot
    assert bot.config is world.config
    assert bot.head_radius == pytest.approx(0.8)


def test_live_food_radius_updates_existing_food():
    world = World()
    foods = world.food_manager.foods
    snapshot = {fid: (f.x, f.y, f.value, f.color) for fid, f in foods.items()}

    world.update_config({"food": {"base_radius": 0.3, "radius_value_scale": 0.2}})

    assert {fid: (f.x, f.y, f.value, f.color) for fid, f in foods.items()} == snapshot
    for food in foods.values():
        expected = 0.3 + math.sqrt(food.value) * 0.2
        assert food.radius == pytest.approx(expected)


def test_live_portal_radius_updates_existing_slot_without_reroll(monkeypatch):
    world = World()
    portal = Portal("portal_test", 10.0, 20.0, 30.0, 40.0, 2.5, "#3b82f6")
    world.portal_manager.slots = [portal, None]
    update_slots_calls = []
    original_update_slots = world.portal_manager.update_slots

    def tracked_update_slots(*args, **kwargs):
        update_slots_calls.append((args, kwargs))
        original_update_slots(*args, **kwargs)

    monkeypatch.setattr(world.portal_manager, "update_slots", tracked_update_slots)

    world.update_config({"world": {"portals_radius": 4.0}})

    assert update_slots_calls == []
    assert world.portal_manager.slots == [portal, None]
    assert portal.id == "portal_test"
    assert (portal.x1, portal.y1, portal.x2, portal.y2) == (10.0, 20.0, 30.0, 40.0)
    assert portal.radius == pytest.approx(4.0)
    assert world.portal_manager.get_cached_list()[0]["radius"] == pytest.approx(4.0)


def test_live_black_hole_radii_update_existing_slot_without_reroll(monkeypatch):
    world = World()
    black_hole = BlackHole("bh_test", 15.0, 25.0, 16.0, 1.2)
    black_hole.current_scale = 1.0
    black_hole.state = "active"
    world.bh_manager.slots = [black_hole, None]
    update_slots_calls = []
    original_update_slots = world.bh_manager.update_slots

    def tracked_update_slots(*args, **kwargs):
        update_slots_calls.append((args, kwargs))
        original_update_slots(*args, **kwargs)

    monkeypatch.setattr(world.bh_manager, "update_slots", tracked_update_slots)

    world.update_config(
        {"world": {"black_holes_pull_radius": 20.0, "black_holes_kill_radius": 2.0}}
    )

    assert update_slots_calls == []
    assert world.bh_manager.slots == [black_hole, None]
    assert black_hole.id == "bh_test"
    assert (black_hole.x, black_hole.y) == (15.0, 25.0)
    assert black_hole.pull_radius == pytest.approx(20.0)
    assert black_hole.kill_radius == pytest.approx(2.0)
    cached = world.bh_manager.get_cached_list()[0]
    assert cached["pull_radius"] == pytest.approx(20.0)
    assert cached["kill_radius"] == pytest.approx(2.0)
