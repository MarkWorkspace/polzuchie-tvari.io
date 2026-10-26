# ROLE: Проверка, что таймеры чёрных дыр двигаются ровно один раз за тик.
import pytest

from app.engine.state import World


def test_black_hole_timer_updates_once_per_tick():
    world = World()
    world.config.world.black_holes_enabled = 1
    world.config.world.black_holes_count = 1
    world.bh_manager.update_slots(force_roll=False)
    world.bh_manager.slots = [None]
    world.bh_manager.timers = [0.0]

    world.tick()

    assert world.bh_manager.timers[0] == pytest.approx(world.tick_interval)
