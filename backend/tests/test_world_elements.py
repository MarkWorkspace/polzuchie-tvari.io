import os
import sys

# Ensure app is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.engine.state import World

def test_world_elements_initialization():
    world = World()
    
    # Check that slots are initialized on startup
    assert len(world.portal_manager.slots) == world.config.world.portals_count, "Portals slots not initialized"
    assert len(world.bh_manager.slots) == world.config.world.black_holes_count, "Black holes slots not initialized"
    print("test_world_elements_initialization passed")

def test_world_elements_update():
    world = World()
    
    import app.engine.game as game
    
    # Tick should update both managers
    game.tick(world)
    
    if world.portal_manager.slots:
        assert world.portal_manager.timers[0] > 0, "Portal manager not updated by tick"
    if world.bh_manager.slots:
        assert world.bh_manager.timers[0] > 0, "Black hole manager not updated by tick"
    print("test_world_elements_update passed")

if __name__ == '__main__':
    test_world_elements_initialization()
    test_world_elements_update()
