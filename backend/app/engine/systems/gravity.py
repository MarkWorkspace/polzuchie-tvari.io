# ROLE: Притяжение чёрных дыр.

import math
from app.engine.systems.math_utils import toroidal_delta
from game_config import CELL_SIZE


def update(state) -> None:
    """
    Updates black hole states, checks if players hit black holes, and pulls food toward them.
    """
    tick_interval = state.tick_interval
    state.bh_manager.update(tick_interval)

    if (
        not state.config.world.black_holes_enabled
        or not state.bh_manager.black_hole_slots
    ):
        return

    _check_player_kills(state)
    _pull_and_consume_food(state, tick_interval)


def _check_player_kills(state) -> None:
    for pid, player in list(state.players.items()):
        if not player.body or player.teleport_state == "in_transit":
            continue

        head = {"x": player.head_x, "y": player.head_y}
        if state.bh_manager.check_kill(head):
            from app.engine.systems.collision import _process_player_death

            _process_player_death(state, pid, player, "black_hole")


def _pull_and_consume_food(state, tick_interval: float) -> None:
    grid_width_cells = max(1, math.ceil(state.grid_width / CELL_SIZE))
    grid_height_cells = max(1, math.ceil(state.grid_height / CELL_SIZE))

    food_grid = getattr(state, "food_grid", {})

    for bh in state.bh_manager.black_hole_slots:
        if bh is None or bh.state == "dead" or bh.current_scale <= 0.01:
            continue
        _pull_food_for_black_hole(
            state, bh, food_grid, grid_width_cells, grid_height_cells, tick_interval
        )


def _pull_food_for_black_hole(
    state, bh, food_grid: dict, grid_w: int, grid_h: int, tick_interval: float
) -> None:
    eff_pull_radius = bh.pull_radius * bh.current_scale
    eff_kill_radius = bh.kill_radius * bh.current_scale
    bh_grid_x = int(bh.x / CELL_SIZE) % grid_w
    bh_grid_y = int(bh.y / CELL_SIZE) % grid_h
    radius_cells = math.ceil(eff_pull_radius / CELL_SIZE)

    for dx in range(-radius_cells, radius_cells + 1):
        for dy in range(-radius_cells, radius_cells + 1):
            cell = ((bh_grid_x + dx) % grid_w, (bh_grid_y + dy) % grid_h)
            if cell not in food_grid:
                continue
            for f in food_grid[cell]:
                if f.eaten:
                    continue
                _apply_bh_pull_on_single_food(
                    state, bh, f, eff_kill_radius, eff_pull_radius, tick_interval
                )


def _apply_bh_pull_on_single_food(
    state, bh, f, kill_r: float, pull_r: float, tick_interval: float
) -> None:
    fdx, fdy = toroidal_delta(f.x, f.y, bh.x, bh.y, state.grid_width, state.grid_height)

    dist = math.hypot(fdx, fdy)
    if dist < kill_r:
        f.eaten = True
        state.food_manager.eaten_foods.append(f.id)
        bh.consumed_food_value += f.value
    elif dist < pull_r:
        pull_dist_factor = (pull_r - dist) / pull_r
        pull_mag = (
            state.config.world.black_holes_pull_force
            * bh.current_scale
            * pull_dist_factor
            * tick_interval
        )
        pull_mag *= 12.0  # Compensation multiplier
        f.x = (f.x + (fdx / dist) * pull_mag) % state.grid_width
        f.y = (f.y + (fdy / dist) * pull_mag) % state.grid_height
        state.food_manager.moved_foods[f.id] = (
            {"id": f.id, "x": round(f.x, 2), "y": round(f.y, 2)}
        )


class GravitySystem:
    name = "gravity"
    order = 40
    
    def update(self, world):
        update(world)

system = GravitySystem()
