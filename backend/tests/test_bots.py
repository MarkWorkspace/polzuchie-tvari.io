# ROLE: Lifecycle, config sync and respawn tests for the isolated bot module.
import pytest

from app.bots.brain import smooth_turn
from app.engine.state import World


def _world(tmp_path, monkeypatch) -> World:
    monkeypatch.setenv("CONFIG_PATH", str(tmp_path / "config.json"))
    return World()


def _bot_ids(world: World) -> list[str]:
    return sorted(pid for pid in world.players if pid.startswith("bot-"))


def test_bot_manager_starts_and_tracks_count(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 2

    world.bot_manager.start()
    assert _bot_ids(world) == ["bot-1", "bot-2"]

    world.config.bots.count = 1
    world.bot_manager.sync()
    assert _bot_ids(world) == ["bot-1"]

    world.config.bots.count = 3
    world.bot_manager.sync()
    assert len(_bot_ids(world)) == 3
    assert "bot-1" in _bot_ids(world)

    world.config.bots.enabled = 0
    world.bot_manager.sync()
    assert _bot_ids(world) == []

    world.bot_manager.stop()


def test_config_update_adds_and_removes_bots_without_kill_events(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 0
    world.config.bots.count = 0
    world.bot_manager.start()

    world.update_config({"bots": {"enabled": 1, "count": 2}})
    assert _bot_ids(world) == ["bot-1", "bot-2"]

    world.kill_events.clear()
    world.update_config({"bots": {"enabled": 0}})
    assert _bot_ids(world) == []
    assert world.kill_events == []


def test_bot_personalities_are_assigned_and_configurable(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 3
    world.config.bots.personality_mode = 0
    world.bot_manager.start()

    assert [world.bot_manager.personality_for(bot) for bot in _bot_ids(world)] == [
        "collector",
        "aggressive",
        "coward",
    ]

    world.config.bots.personality_mode = 2
    world.bot_manager.sync()
    assert all(world.bot_manager.personality_for(bot) == "aggressive" for bot in _bot_ids(world))


def test_bot_respawns_after_death_delay(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 1
    world.config.bots.respawn_delay_seconds = 0.1
    world.bot_manager.start()

    bot = world.players["bot-1"]
    bot.is_dead = True
    bot.body.clear()

    for _ in range(4):
        world.bot_manager.update()

    assert not bot.is_dead
    assert bot.body_len > 0


def test_bot_turn_changes_gradually_between_ticks(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 1
    world.config.bots.personality_mode = 1
    world.bot_manager.start()

    bot = world.players["bot-1"]
    for food in world.food_manager.foods.values():
        food.eaten = True
    world.food_manager.spawn_specific_food(bot.head_x + 2, bot.head_y + 8, 100)

    world.bot_manager.update()
    first_turn = bot.turn
    world.bot_manager.update()
    second_turn = bot.turn

    assert 0 < first_turn <= 0.12
    assert abs(second_turn - first_turn) <= 0.12


def test_smooth_turn_is_rate_limited_and_converges():
    previous = 0.0
    for _ in range(40):
        next_turn = smooth_turn(previous, 1.0)
        assert abs(next_turn - previous) <= 0.12 + 1e-9
        previous = next_turn

    assert previous == pytest.approx(1.0)


def test_bot_steering_sets_normalized_turn_for_every_personality(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 1
    world.bot_manager.start()

    for mode, personality in ((1, "collector"), (2, "aggressive"), (3, "coward")):
        world.config.bots.personality_mode = mode
        world.bot_manager.sync()
        world.bot_manager.update()

        bot = world.players["bot-1"]
        assert world.bot_manager.personality_for("bot-1") == personality
        assert bot.steered_by_mouse is True
        assert -1.0 <= bot.turn <= 1.0
