# ROLE: Поедание и притяжение еды.

import math
from app.engine.systems.math_utils import toroidal_delta
from game_config import CELL_SIZE


def update(state) -> None:
    """
    Checks food consumption and pulls nearby food items toward player heads.
    """
    grid_w = max(1, math.ceil(state.grid_width / CELL_SIZE))
    grid_h = max(1, math.ceil(state.grid_height / CELL_SIZE))

    spatial_grid = getattr(state, "spatial_grid", {})

    attraction_radius = state.config.food.attraction_radius
    attraction_speed = state.config.food.attraction_speed * state.tick_interval
    attracted_ids = set()

    for pid, player in state.players.items():
        if not player.body or player.teleport_state == "in_transit":
            continue
        _process_eating_for_player(
            state,
            player,
            spatial_grid,
            grid_w,
            grid_h,
            attraction_radius,
            attraction_speed,
            attracted_ids,
        )


def _process_eating_for_player(
    state,
    player,
    spatial_grid: dict,
    grid_w: int,
    grid_h: int,
    attr_r: float,
    attr_s: float,
    attracted_ids: set,
) -> None:
    hx, hy = player.head_x, player.head_y
    grid_x = int(hx / CELL_SIZE) % grid_w
    grid_y = int(hy / CELL_SIZE) % grid_h
    head_radius = player.head_radius

    eaten_value = 0
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cell = ((grid_x + dx) % grid_w, (grid_y + dy) % grid_h)
            if cell not in spatial_grid:
                continue
            for f in spatial_grid[cell]["foods"]:
                if f.eaten:
                    continue
                dist_x, dist_y = toroidal_delta(
                    hx, hy, f.x, f.y, state.grid_width, state.grid_height
                )
                if (dist_x * dist_x + dist_y * dist_y) < (
                    (head_radius + f.radius) ** 2
                ):
                    eaten_value += f.value
                    f.eaten = True
                    state.food_manager.eaten_foods.append(f.id)
                    attracted_ids.add(f.id)

    if eaten_value > 0:
        player.score += eaten_value
        player.pending_growth += eaten_value

    if attr_r > 0 and attr_s > 0:
        _apply_food_attraction(
            state, player, spatial_grid, grid_w, grid_h, attr_r, attr_s, attracted_ids
        )


def _apply_food_attraction(
    state,
    player,
    spatial_grid: dict,
    grid_w: int,
    grid_h: int,
    attr_r: float,
    attr_s: float,
    attracted_ids: set,
) -> None:
    hx, hy = player.head_x, player.head_y
    grid_x = int(hx / CELL_SIZE) % grid_w
    grid_y = int(hy / CELL_SIZE) % grid_h
    radius_cells = int(attr_r / CELL_SIZE) + 1
    eat_r = player.head_radius

    for dx in range(-radius_cells, radius_cells + 1):
        for dy in range(-radius_cells, radius_cells + 1):
            cell = ((grid_x + dx) % grid_w, (grid_y + dy) % grid_h)
            if cell not in spatial_grid:
                continue
            for f in spatial_grid[cell]["foods"]:
                if not f.eaten and f.id not in attracted_ids:
                    _attract_single_food(
                        state, player, f, hx, hy, attr_r, attr_s, eat_r, attracted_ids
                    )


def _attract_single_food(
    state,
    player,
    f,
    hx: float,
    hy: float,
    attr_r: float,
    attr_s: float,
    eat_r: float,
    attracted_ids: set,
) -> None:
    fdx, fdy = toroidal_delta(f.x, f.y, hx, hy, state.grid_width, state.grid_height)
    dist_sq = fdx * fdx + fdy * fdy
    eff_eat_r = eat_r + f.radius
    if dist_sq <= eff_eat_r * eff_eat_r:
        _eat_attracted_food(state, player, f, attracted_ids)
        return

    if dist_sq < attr_r * attr_r and dist_sq > 0.001:
        dist = math.sqrt(dist_sq)
        move = min(attr_s, dist * 0.5)
        f.x = (f.x + (fdx / dist) * move) % state.grid_width
        f.y = (f.y + (fdy / dist) * move) % state.grid_height
        attracted_ids.add(f.id)

        pdx, pdy = toroidal_delta(f.x, f.y, hx, hy, state.grid_width, state.grid_height)
        if (pdx * pdx + pdy * pdy) <= eff_eat_r * eff_eat_r:
            _eat_attracted_food(state, player, f, attracted_ids)
        else:
            state.food_manager.moved_foods[f.id] = {"id": f.id, "x": f.x, "y": f.y}


def _eat_attracted_food(state, player, f, attracted_ids: set) -> None:
    f.eaten = True
    state.food_manager.eaten_foods.append(f.id)
    player.score += f.value
    player.pending_growth += f.value
    attracted_ids.add(f.id)


class Food_eatingSystem:
    name = "food_eating"
    order = 50
    
    def update(self, world):
        update(world)

system = Food_eatingSystem()
