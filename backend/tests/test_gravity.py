# ROLE: Тестирование системы гравитации (притяжения еды).
import os
import sys

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engine.state import World
from app.engine.entities import Food, BlackHole
from app.engine.systems.gravity import update as gravity_update
from app.engine.systems.spatial_index import update as spatial_index_update

def test_gravity_pulls_food():
    world = World()
    world.config.world.black_holes_enabled = 1
    
    # Spawn a black hole at (50.0, 50.0)
    world.bh_manager.slots = []
    bh = BlackHole("bh_test", 50.0, 50.0, pull_radius=20.0, kill_radius=2.0)
    bh.state = "alive"
    bh.current_scale = 1.0
    world.bh_manager.slots.append(bh)
    
    # Spawn food at (55.0, 50.0) - inside pull_radius (distance = 5.0)
    f = Food(999, 55.0, 50.0, 1, world.config, color="#ff0000", image="")
    world.food_manager.foods = {999: f}
    
    # Update spatial index
    spatial_index_update(world)
    
    # Verify food is in spatial grid
    assert any(food.id == 999 for cell in world.spatial_grid.values() for food in cell["foods"])
    
    # Run gravity system
    gravity_update(world)
    
    # Food should be pulled closer to bh (x should decrease)
    assert f.x < 55.0
