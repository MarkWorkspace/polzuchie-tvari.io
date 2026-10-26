# ROLE: Гонка между prepare_cache и подключением игрока не должна ронять broadcast.
from app.engine.state import World
from app.engine.systems import snake_pb2
from app.engine.systems.serialization import _serialize_players_data, prepare_cache


def test_late_join_outside_aoi_uses_cache_fallback():
    world = World()
    world.add_player("a", "A", "#22c55e")
    prepare_cache(world)

    # Player connects after the tick cache was built.
    world.add_player("late", "Late", "#3b82f6")
    late = world.players["late"]
    late.body.clear()
    late.body.extend([99.0, 99.0])

    frame = snake_pb2.GameStateFrame()
    _serialize_players_data(world, world.players, {"a"}, {"a"}, False, frame.players)

    assert "late" in frame.players
    assert frame.players["late"].is_dead is False


def test_missing_caches_do_not_raise():
    world = World()
    world.add_player("a", "A", "#22c55e")
    world.full_players_cache = {}
    world.mini_players_cache = {}

    frame = snake_pb2.GameStateFrame()
    _serialize_players_data(world, world.players, {"a"}, {"a"}, False, frame.players)

    assert "a" in frame.players
