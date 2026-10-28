# ROLE: Жизненный цикл World: resize карты и полная очистка при restart.
import math

from game_config import CELL_SIZE
from app.engine.state import World


def _world(monkeypatch):
    world = World()
    monkeypatch.setattr(world, "_save_config_to_disk", lambda *args, **kwargs: None)
    return world


def test_config_resize_recomputes_spatial_cells(monkeypatch):
    world = _world(monkeypatch)

    world.update_config({"world": {"width": 200, "height": 150}})

    assert world.grid_width == 200
    assert world.grid_height == 150
    assert world._grid_width_cells == math.ceil(200 / CELL_SIZE)
    assert world._grid_height_cells == math.ceil(150 / CELL_SIZE)


def test_reset_state_clears_all_transient_state(monkeypatch):
    world = _world(monkeypatch)
    world.add_player("a", "A", "#22c55e")
    world.spectators.add("spectator")
    world.input_queue.append(("a", "LEFT_DOWN"))
    world.tombstones.append({"id": "tomb", "x": 1, "y": 2, "nickname": "A", "time_left": 60})
    world.tombstone_seq = 7
    world.full_players_cache["a"] = object()
    world.mini_players_cache["a"] = object()
    world.spatial_grid[(0, 0)] = {"players": [], "foods": [], "tombstones": []}

    world.reset_state()

    assert world.players == {}
    assert world.spectators == set()
    assert world.input_queue == []
    assert world.tombstones == []
    assert world.tombstone_seq == 0
    assert world.full_players_cache == {}
    assert world.mini_players_cache == {}
    assert world.spatial_grid == {}


def test_reset_state_recomputes_cells_after_direct_config_change(monkeypatch):
    world = _world(monkeypatch)
    world.config.world.width = 300
    world.config.world.height = 200

    world.reset_state()

    assert world.grid_width == 300
    assert world.grid_height == 200
    assert world._grid_width_cells == math.ceil(300 / CELL_SIZE)
    assert world._grid_height_cells == math.ceil(200 / CELL_SIZE)
