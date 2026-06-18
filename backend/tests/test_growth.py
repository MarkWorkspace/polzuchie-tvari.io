import pytest
import math
from app.engine.state import World
from app.engine.entities import Player
from app.engine.systems import growth, physics

def test_growth_positive():
    state = World()
    player = Player("test_1", 50.0, 50.0, state.config, nickname="Test Player")
    state.players[player.id] = player
    
    # Move once
    player.speed_mult = 1.0
    physics.update(state)
    
    initial_len = len(player.body)
    
    # Test positive growth: pending_growth > cost
    cost = max(0.1, float(state.growth_segment_cost_func(player.score, player.body_len)))
    player.pending_growth = cost + 0.1
    player.steps_this_tick = 1
    
    growth.update(state)
    
    # When pending_growth >= cost, tail is NOT popped, so length remains the same after physics added to head.
    assert len(player.body) == initial_len
    assert math.isclose(player.pending_growth, 0.1, rel_tol=1e-5)

def test_growth_normal():
    state = World()
    player = Player("test_1", 50.0, 50.0, state.config, nickname="Test Player")
    state.players[player.id] = player
    
    physics.update(state)
    initial_len = len(player.body)
    
    # Test normal movement: pending_growth < cost
    player.pending_growth = 0.0
    player.steps_this_tick = 1
    
    growth.update(state)
    
    # When pending_growth < cost, tail IS popped, so length decreases by 2 (x and y) from what physics added.
    assert len(player.body) == initial_len - 2

def test_growth_shrinkage():
    state = World()
    player = Player("test_1", 50.0, 50.0, state.config, nickname="Test Player")
    state.players[player.id] = player
    
    physics.update(state)
    initial_len = len(player.body)
    
    # Test shrinkage: pending_growth <= -cost
    state.config.snake.min_body_length = 2
    cost = max(0.1, float(state.growth_segment_cost_func(player.score, player.body_len)))
    player.pending_growth = -cost - 0.1
    player.steps_this_tick = 1
    
    growth.update(state)
    
    # When pending_growth <= -cost, tail is popped TWICE (4 elements). 
    assert len(player.body) == initial_len - 4
    assert math.isclose(player.pending_growth, -0.1, rel_tol=1e-5)
