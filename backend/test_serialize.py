import asyncio
from app.engine.state import World

def test():
    world = World()
    world.add_player("test_id", "Player", "#22c55e")
    
    # We must run update to prepare cache
    from app.engine.systems.serialization import system
    system.update(world)
    
    full = world.get_full_state("test_id")
    import msgpack
    import zlib
    try:
        data = zlib.compress(msgpack.packb(full))
        print("Success:", len(data))
    except Exception as e:
        print("Error:", e)
        import traceback
        traceback.print_exc()

test()
