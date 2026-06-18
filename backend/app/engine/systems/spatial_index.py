import math
from collections import defaultdict
from game_config import CELL_SIZE

def update(state) -> None:
    """
    Builds a unified spatial index for the current tick.
    """
    state.spatial_grid = defaultdict(lambda: {"players": [], "foods": [], "tombstones": []})
    
    grid_w = state._grid_width_cells
    grid_h = state._grid_height_cells
    
    # 1. Add Tombstones
    for tomb in state.tombstones:
        if tomb["time_left"] > 58.5: # Arming time
            continue
        cx = int(tomb["x"] / CELL_SIZE) % grid_w
        cy = int(tomb["y"] / CELL_SIZE) % grid_h
        state.spatial_grid[(cx, cy)]["tombstones"].append(
            ("tombstone", tomb["x"], tomb["y"], 1.2)
        )
        
    # 2. Add Players
    for pid, player in state.players.items():
        if not player.body or player.teleport_state == "in_transit" or player.is_dead:
            continue
        radius = player.head_radius
        for i in range(0, len(player.body), 2):
            pt_x, pt_y = player.body[i], player.body[i + 1]
            cx = int(pt_x / CELL_SIZE) % grid_w
            cy = int(pt_y / CELL_SIZE) % grid_h
            state.spatial_grid[(cx, cy)]["players"].append((pid, pt_x, pt_y, radius))
            
    # 3. Add Foods
    for f in state.food_manager.foods.values():
        if f.eaten:
            continue
        cx = int(f.x / CELL_SIZE) % grid_w
        cy = int(f.y / CELL_SIZE) % grid_h
        state.spatial_grid[(cx, cy)]["foods"].append(f)

class SpatialIndexSystem:
    name = "spatial_index"
    order = 15
    
    def update(self, world):
        update(world)

system = SpatialIndexSystem()
