# ROLE: Lifecycle, config sync and respawn tests for the isolated bot module.
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


def test_bot_steering_sets_normalized_turn(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.config.bots.enabled = 1
    world.config.bots.count = 1
    world.bot_manager.start()

    world.bot_manager.update()

    bot = world.players["bot-1"]
    assert bot.steered_by_mouse is True
    assert -1.0 <= bot.turn <= 1.0
    assert bot.accelerating is False
