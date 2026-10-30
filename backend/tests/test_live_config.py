# ROLE: Live-config regression tests: existing players and bots see the new config after update.
import pytest

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
