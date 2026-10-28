# ROLE: Pure steering decisions for server bots. No lifecycle, networking or rendering.
import math

from app.engine.systems.math_utils import toroidal_delta, toroidal_distance
from app.engine.systems.physics import max_turn_per_tick
from game_config import CELL_SIZE

CANDIDATE_OFFSETS = (0.0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4)


def choose_turn(state, player) -> float:
    """Return a normalized turn in [-1, 1] for one bot tick."""
    target = _best_food(state, player)
    desired_angle = player.angle if target is None else math.atan2(target[1], target[0])

    best_angle = player.angle
    best_score = -math.inf
    for offset in CANDIDATE_OFFSETS:
        angle = player.angle + offset
        clearance = _path_clearance(state, player, angle)
        score = _score_candidate(clearance, angle, desired_angle, target, offset)
        if score > best_score:
            best_score = score
            best_angle = angle

    delta = _wrap_angle(best_angle - player.angle)
    turn_speed = max_turn_per_tick(state, player)
    return max(-1.0, min(1.0, delta / max(turn_speed, 1e-6)))


def _best_food(state, player):
    best = None
    best_score = 0.0
    for food in state.food_manager.foods.values():
        if food.eaten:
            continue
        dx, dy = toroidal_delta(
            player.head_x, player.head_y, food.x, food.y, state.grid_width, state.grid_height
        )
        distance = math.hypot(dx, dy)
        if distance < 0.01:
            continue
        score = food.value / (distance + 2.0)
        if score > best_score:
            best_score = score
            best = (dx, dy, distance)
    return best


def _score_candidate(clearance, angle, desired_angle, target, offset) -> float:
    if clearance <= 0:
        return clearance
    score = 1.0 + min(clearance, 5.0) * 0.5
    if target is not None:
        score += max(0.0, math.cos(_wrap_angle(desired_angle - angle))) * 2.0
    return score - abs(offset) * 0.05


def _path_clearance(state, player, angle) -> float:
    lookahead = max(2.5, state.config.simulation.base_speed_per_second * state.tick_interval * 4)
    x = (player.head_x + math.cos(angle) * lookahead) % state.grid_width
    y = (player.head_y + math.sin(angle) * lookahead) % state.grid_height
    clearance = 100.0

    grid = getattr(state, "spatial_grid", {})
    grid_x = int(x / CELL_SIZE) % state._grid_width_cells
    grid_y = int(y / CELL_SIZE) % state._grid_height_cells
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cell = (
                (grid_x + dx) % state._grid_width_cells,
                (grid_y + dy) % state._grid_height_cells,
            )
            cell_data = grid.get(cell)
            if not cell_data:
                continue
            for other_id, seg_x, seg_y, radius in cell_data["players"] + cell_data["tombstones"]:
                if other_id == player.id:
                    continue
                distance = toroidal_distance(
                    x, y, seg_x, seg_y, state.grid_width, state.grid_height
                )
                clearance = min(clearance, distance - (player.head_radius + radius * 0.8))

    for black_hole in state.bh_manager.black_hole_slots:
        if black_hole is None or black_hole.state == "dead" or black_hole.current_scale <= 0.01:
            continue
        distance = toroidal_distance(
            x, y, black_hole.x, black_hole.y, state.grid_width, state.grid_height
        )
        kill_radius = black_hole.kill_radius * black_hole.current_scale
        pull_radius = black_hole.pull_radius * black_hole.current_scale
        clearance = min(clearance, distance - kill_radius)
        if distance < pull_radius:
            clearance = min(clearance, (distance - pull_radius) * 0.25)

    return clearance


def _wrap_angle(angle: float) -> float:
    return (angle + math.pi) % (2 * math.pi) - math.pi
