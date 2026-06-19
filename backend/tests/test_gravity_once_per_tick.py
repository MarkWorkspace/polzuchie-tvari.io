# ROLE: Тест: гравитация чёрных дыр применяется к углу змейки ровно один раз за тик.
import math
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engine.state import World
from app.engine.entities import Player, BlackHole
from app.engine.systems import physics


def _make_world_with_bh(bh_x, bh_y, pull_radius=20.0):
    """Create a world with a single active black hole."""
    world = World()
    world.config.world.black_holes_enabled = 1
    bh = BlackHole("bh_test", bh_x, bh_y, pull_radius=pull_radius, kill_radius=2.0)
    bh.state = "alive"
    bh.current_scale = 1.0
    world.bh_manager.slots = [bh]
    return world


def test_gravity_bend_applied_once_per_tick():
    """
    Regression: gravity bend must be applied exactly once per tick,
    regardless of steps_this_tick (speed_mult).
    Before the fix, gravity was applied 1 + steps_this_tick times.
    """
    bh_x, bh_y = 50.0, 55.0
    start_x, start_y = 50.0, 50.0  # 5 units south of BH

    # Player with speed_mult=1 (1 step per tick)
    world1 = _make_world_with_bh(bh_x, bh_y)
    p1 = Player("p1", start_x, start_y, world1.config, nickname="Slow")
    p1.angle = 0.0
    p1.turn = 0
    p1.speed_mult = 1.0
    world1.players[p1.id] = p1

    # Player with speed_mult=2 (2 steps per tick)
    world2 = _make_world_with_bh(bh_x, bh_y)
    p2 = Player("p2", start_x, start_y, world2.config, nickname="Fast")
    p2.angle = 0.0
    p2.turn = 0
    p2.speed_mult = 2.0
    world2.players[p2.id] = p2

    physics.update(world1)
    physics.update(world2)

    # Both players should get the same gravity bend (applied once).
    # Movement distance differs, but the gravity-induced angle change
    # must be identical since it's applied once before the step loop.
    assert math.isclose(p1.angle, p2.angle, abs_tol=1e-6), (
        f"Gravity bend differs with speed_mult: "
        f"speed_mult=1 angle={p1.angle:.6f}, speed_mult=2 angle={p2.angle:.6f}"
    )


def test_gravity_bend_not_zero_near_bh():
    """Sanity check: gravity bend actually has an effect near a black hole."""
    world = _make_world_with_bh(50.0, 55.0)
    p = Player("p1", 50.0, 50.0, world.config, nickname="Test")
    p.angle = 0.0  # Facing east, BH is north
    p.turn = 0
    p.speed_mult = 1.0
    world.players[p.id] = p

    physics.update(world)

    # BH is to the north (+Y), player faces east (angle=0).
    # Gravity should bend the angle toward the BH (positive angle).
    assert p.angle > 0.0, f"Expected positive gravity bend, got angle={p.angle}"
