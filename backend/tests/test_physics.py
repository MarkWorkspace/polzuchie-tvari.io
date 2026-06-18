import pytest
import math
from app.engine.state import World
from app.engine.entities import Player
from app.engine.systems import physics

def test_physics_normal_movement():
    state = World()
    
    player = Player("test_1", 50.0, 50.0, state.config, nickname="Test Player")
    player.angle = 0.0 # Facing right
    player.speed_mult = 1.0
    player.turn = 1 # turning right (positive angle)
    
    state.players[player.id] = player
    
    physics.update(state)
    
    assert player.angle > 0.0
    
    expected_dist = state.config.simulation.base_speed_per_second * state.tick_interval
    actual_dist = math.hypot(player.head_x - 50.0, player.head_y - 50.0)
    assert math.isclose(actual_dist, expected_dist, rel_tol=1e-2)

def test_physics_boost_movement():
    state = World()
    
    player = Player("test_1", 50.0, 50.0, state.config, nickname="Test Player")
    player.angle = 0.0
    player.speed_mult = 2.0 # boosting
    player.turn = 1
    
    state.players[player.id] = player
    
    player_normal = Player("test_normal", 50.0, 50.0, state.config, nickname="Normal Player")
    player_normal.angle = 0.0
    player_normal.speed_mult = 1.0
    player_normal.turn = 1
    state.players[player_normal.id] = player_normal
    
    physics.update(state) # update both
    
    assert math.isclose(player.angle, player_normal.angle, rel_tol=1e-5), f"Boosted angle {player.angle} != normal angle {player_normal.angle}"
