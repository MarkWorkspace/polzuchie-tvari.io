import pytest
from collections import deque
from app.engine.state import World
from app.engine.entities import Player
from app.engine.systems import collision, spatial_index

def test_collision_with_other():
    state = World()
    
    # Player 1
    p1 = Player("p1", 50.0, 50.0, state.config)
    p1.body = deque([50.0, 50.0, 49.0, 50.0, 48.0, 50.0]) # head at 50.0, 50.0
    state.players[p1.id] = p1
    
    # Player 2
    p2 = Player("p2", 49.0, 50.0, state.config)
    # Head at 49.0, 50.0 (collides with p1's second segment)
    p2.body = deque([49.0, 50.0, 49.0, 49.0, 49.0, 48.0])
    state.players[p2.id] = p2
    
    spatial_index.update(state)
    collision.check(state)
    
    assert p2.deaths == 1
    assert p1.deaths == 0
    assert p1.kills == 1
    assert len(state.kill_events) == 1
    assert state.kill_events[0]["victim"] == "p2"
    assert state.kill_events[0]["killer"] == "p1"

def test_collision_no_self_kill():
    state = World()
    p1 = Player("p1", 50.0, 50.0, state.config)
    # Head at 50.0, 50.0
    p1.body = deque([50.0, 50.0, 50.0, 50.0, 50.0, 50.0])
    state.players[p1.id] = p1
    
    spatial_index.update(state)
    collision.check(state)
    assert p1.deaths == 0
