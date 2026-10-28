# ROLE: Pure steering decisions for server bots (collector / aggressive / coward). No lifecycle or networking.
import math

from app.engine.systems.math_utils import toroidal_delta, toroidal_distance
from app.engine.systems.physics import max_turn_per_tick
from game_config import CELL_SIZE

PERSONALITIES = ("collector", "aggressive", "coward")
CANDIDATE_OFFSETS = (0.0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4)
MIN_CLEARANCE = {"collector": 0.3, "aggressive": -0.5, "coward": 1.5}
COWARD_RADIUS = 18.0
AGGRESSIVE_BOOST_RANGE = 7.0


def decide(state, player, personality: str = "collector") -> tuple[float, bool]:
    """Return (normalized turn, accelerate) for one bot tick."""
    target = _target(state, player, personality)
    desired_angle = player.angle if target is None else target[0]

    best_angle = player.angle
    best_score = -math.inf
    for offset in CANDIDATE_OFFSETS:
        angle = player.angle + offset
        clearance = _path_clearance(state, player, angle)
        score = _score_candidate(clearance, angle, desired_angle, target, offset, personality)
        if score > best_score:
            best_score = score
            best_angle = angle

    delta = _wrap_angle(best_angle - player.angle)
    turn_speed = max_turn_per_tick(state, player)
    turn = max(-1.0, min(1.0, delta / max(turn_speed, 1e-6)))
    return turn, _should_boost(state, player, personality, target)


def _target(state, player, personality: str):
    if personality == "aggressive":
        player_target = _nearest_player(state, player)
        if player_target is not None:
            angle, distance, is_player = player_target
            return angle, distance, is_player
    elif personality == "coward":
        threat = _nearest_threat(state, player)
        if threat is not None and threat[2] < COWARD_RADIUS:
            return threat[0], threat[1], False

    food = _best_food(state, player)
    if food is None:
        return None
    dx, dy, distance = food
    return math.atan2(dy, dx), distance, False


def _nearest_player(state, player):
    best = None
    best_distance = math.inf
    for other in state.players.values():
        if other.id == player.id or other.is_dead or not other.body:
            continue
        dx, dy = toroidal_delta(
            player.head_x,
            player.head_y,
            other.head_x,
            other.head_y,
            state.grid_width,
            state.grid_height,
        )
        distance = math.hypot(dx, dy)
        if distance >= best_distance:
            continue
        lead = min(4.0, 2.0 + other.body_len * 0.1)
        target_x = (other.head_x + math.cos(other.angle) * lead) % state.grid_width
        target_y = (other.head_y + math.sin(other.angle) * lead) % state.grid_height
        tdx, tdy = toroidal_delta(
            player.head_x, player.head_y, target_x, target_y, state.grid_width, state.grid_height
        )
        best_distance = distance
        best = (math.atan2(tdy, tdx), distance, True)
    return best


def _nearest_threat(state, player):
    best = None
    best_distance = math.inf
    for other in state.players.values():
        if other.id == player.id or other.is_dead or not other.body:
            continue
        dx, dy = toroidal_delta(
            player.head_x,
            player.head_y,
            other.head_x,
            other.head_y,
            state.grid_width,
            state.grid_height,
        )
        distance = math.hypot(dx, dy)
        if distance < best_distance:
            best_distance = distance
            best = (math.atan2(-dy, -dx), distance, False)

    for black_hole in state.bh_manager.black_hole_slots:
        if black_hole is None or black_hole.state == "dead" or black_hole.current_scale <= 0.01:
            continue
        boundary = black_hole.pull_radius * black_hole.current_scale
        dx, dy = toroidal_delta(
            player.head_x,
            player.head_y,
            black_hole.x,
            black_hole.y,
            state.grid_width,
            state.grid_height,
        )
        distance = math.hypot(dx, dy)
        edge_distance = max(0.0, distance - boundary)
        if edge_distance < best_distance:
            best_distance = edge_distance
            best = (math.atan2(-dy, -dx), edge_distance, False)
    return best


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


def _score_candidate(clearance, angle, desired_angle, target, offset, personality) -> float:
    threshold = MIN_CLEARANCE.get(personality, 0.3)
    if clearance < threshold:
        return clearance - threshold
    score = 1.0 + min(clearance, 5.0) * 0.5
    if target is not None:
        weight = 2.5 if personality == "aggressive" else 2.0
        score += max(0.0, math.cos(_wrap_angle(desired_angle - angle))) * weight
    return score - abs(offset) * 0.05


def _should_boost(state, player, personality: str, target) -> bool:
    if personality != "aggressive" or target is None or not target[2]:
        return False
    return target[1] < AGGRESSIVE_BOOST_RANGE and player.score > state.config.boost.min_score + 2


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
