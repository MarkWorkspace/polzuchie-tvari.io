# ROLE: Regression tests for integer score after boost drain and late-join full sync.
from app.engine.state import World
from app.engine.systems import boost


def test_boost_drain_keeps_score_integer(tmp_path, monkeypatch):
    monkeypatch.setenv("CONFIG_PATH", str(tmp_path / "config.json"))
    world = World()
    world.config.boost.drain_interval_seconds = 0.1
    world.config.boost.drain_per_interval = 1.0
    world.add_player("p1")
    player = world.players["p1"]

    player.score = 20
    player.accelerating = True
    player.boost_drop = 0.1
    boost.update(world)

    assert player.score == 19
    assert isinstance(player.score, int)


def test_late_player_can_join_after_boost_drain(tmp_path, monkeypatch):
    """A drained bot must not break the full-sync path for a new player."""
    monkeypatch.setenv("CONFIG_PATH", str(tmp_path / "config.json"))
    world = World()
    world.config.boost.drain_interval_seconds = 0.1
    world.config.boost.drain_per_interval = 1.0
    world.add_player("bot-1", "Bot 1")

    bot = world.players["bot-1"]
    bot.score = 20
    bot.accelerating = True
    bot.boost_drop = 0.1
    boost.update(world)

    world.add_player("late-player", "Late")
    frame = world.get_full_state("late-player", serialize_proto=True)

    assert frame
