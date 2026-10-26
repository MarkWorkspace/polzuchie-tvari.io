# ROLE: Мёртвый или телепортирующийся игрок не должен двигаться/есть/бустить.
from app.engine.entities import Player
from app.engine.state import World
from app.engine.systems import boost, teleportation
from app.engine.systems.collision import _process_player_death


def _make_world():
    world = World()
    player = Player("dead", 50.0, 50.0, world.config, nickname="Dead")
    world.players[player.id] = player
    return world, player


def test_death_clears_teleport_state_and_heads():
    world, player = _make_world()
    player.teleport_state = "entering"
    player.teleport_pos = {"x": 50.0, "y": 50.0}
    player.teleport_out_pos = (60.0, 60.0)
    player.teleport_timer = 0.0
    player.accelerating = True
    player.new_heads_this_tick = [1.0, 2.0]

    _process_player_death(world, player.id, player, "black_hole")

    assert player.is_dead is True
    assert player.teleport_state == "none"
    assert player.teleport_pos is None
    assert player.teleport_out_pos is None
    assert player.new_heads_this_tick == []
    assert len(player.body) == 0

    # Must not resurrect the body or crash on an empty body.
    teleportation.update(world)
    assert len(player.body) == 0


def test_death_is_idempotent():
    world, player = _make_world()

    _process_player_death(world, player.id, player, None)
    _process_player_death(world, player.id, player, None)

    assert player.deaths == 1
    assert len(world.kill_events) == 1


def test_dead_player_is_not_draining_boost():
    world, player = _make_world()
    player.is_dead = True
    player.accelerating = True
    player.score = 100
    score_before = player.score

    boost.update(world)

    assert player.score == score_before
    assert player.speed_mult == 1.0
    assert player.is_accelerating_valid is False
