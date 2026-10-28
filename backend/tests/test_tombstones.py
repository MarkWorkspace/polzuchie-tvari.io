# ROLE: Tombstone identity, collision radius and reset lifecycle regression tests.
from collections import deque

from app.engine.entities import Player
from app.engine.state import World
from app.engine.systems import collision, spatial_index


def _world(tmp_path, monkeypatch):
    monkeypatch.setenv("CONFIG_PATH", str(tmp_path / "config.json"))
    world = World()
    world.portal_manager.slots = []
    return world


def _player(world, x=50.0, y=50.0):
    player = Player("p1", x, y, world.config)
    player.body = deque([x, y, x - 1.0, y])
    world.players["p1"] = player
    return player


def test_tombstone_ids_stay_unique_after_respawn(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    player = _player(world)

    collision._process_player_death(world, "p1", player, None)
    first_id = world.tombstones[-1]["id"]

    player.respawn(10.0, 10.0)
    collision._process_player_death(world, "p1", player, None)
    second_id = world.tombstones[-1]["id"]

    assert first_id != second_id
    assert len({tomb["id"] for tomb in world.tombstones}) == 2


def test_tombstone_collision_radius_matches_rendered_stone(tmp_path, monkeypatch):
    world = _world(tmp_path, monkeypatch)
    world.tombstones = [{"id": "tomb_1", "x": 50.0, "y": 50.0, "nickname": "A", "time_left": 30.0}]

    spatial_index.update(world)

    entries = [entry for cell in world.spatial_grid.values() for entry in cell["tombstones"]]
    assert entries == [("tombstone", 50.0, 50.0, spatial_index.TOMBSTONE_COLLISION_RADIUS)]
