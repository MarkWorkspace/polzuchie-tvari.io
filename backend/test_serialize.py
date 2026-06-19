# ROLE: Offline test for Protobuf serialization verification.

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.engine.state import World
from app.engine.systems.serialization import system, get_full_state
from app.engine.systems import snake_pb2


def test():
    world = World()
    world.add_player("test_id", "Player", "#22c55e")
    
    system.update(world)
    
    # Get full state message
    frame = get_full_state(world, "test_id", serialize_proto=False)
    
    print("Frame Type:", frame.type)
    print("Server Tick Rate:", frame.server_tick_rate)
    print("Your ID:", frame.your_id)
    print("Players count:", len(frame.players))
    if "test_id" in frame.players:
        p = frame.players["test_id"]
        print("  Player Nickname:", p.nickname)
        print("  Player Skin:", p.skin)
        print("  Player Body length:", len(p.body))
        print("  Player Body coordinates:", list(p.body))
    
    print("Foods count:", len(frame.foods))
    print("Portals count:", len(frame.portals))
    print("Black Holes count:", len(frame.black_holes))
    
    # Config checks
    print("World width:", frame.server_world.width)
    print("World height:", frame.server_world.height)
    print("World portals_enabled:", frame.server_world.portals_enabled)
    print("World black_holes_enabled:", frame.server_world.black_holes_enabled)


if __name__ == "__main__":
    test()
