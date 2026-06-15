# ROLE: Расчёт зоны видимости (Area of Interest - AoI) и фильтрация игроков.

import math
from game_config import CELL_SIZE


def get_visible_players(state, client_id):
    client_player = state.players.get(client_id)
    if client_player and client_player.body_len > 0:
        cx, cy = client_player.head_x, client_player.head_y
        eff_score = (
            max(0, client_player.body_len - state.config.snake.start_length) * 10.0
        )
    else:
        cx, cy = state.grid_width / 2, state.grid_height / 2
        eff_score = 0

    fog_r_world = (
        state.config.visual.min_fog_radius
        + eff_score * state.config.visual.fog_score_expansion_coeff
    )
    fog_r_grid = fog_r_world / 20.0

    candidates = _get_candidates(state, cx, cy, fog_r_grid, client_player, client_id)

    current_visible = set()
    for pid, p in candidates.items():
        if p.body_len > 0 and _is_in_aoi(state, pid, p, client_id, cx, cy, fog_r_grid):
            current_visible.add(pid)

    return current_visible, candidates


def _get_candidates(
    state, cx: float, cy: float, fog_r_grid: float, client_player, client_id: str
) -> dict:
    max_safe_r = (fog_r_grid + state._max_player_body_len * 0.5) * 1.03
    gcx = int(cx / CELL_SIZE) % state._grid_width_cells
    gcy = int(cy / CELL_SIZE) % state._grid_height_cells
    cell_range = math.ceil(max_safe_r / CELL_SIZE)

    candidate_players = []
    for dx in range(-cell_range, cell_range + 1):
        for dy in range(-cell_range, cell_range + 1):
            cell = (
                (gcx + dx) % state._grid_width_cells,
                (gcy + dy) % state._grid_height_cells,
            )
            if cell in state.player_grid:
                candidate_players.extend(state.player_grid[cell])

    candidates_dict = {pid: p for pid, p in candidate_players}
    if client_player and client_id not in candidates_dict:
        candidates_dict[client_id] = client_player
    return candidates_dict


def _is_in_aoi(
    state, pid: str, p, client_id: str, cx: float, cy: float, fog_r_grid: float
) -> bool:
    if pid == client_id:
        return True
    fdx = p.head_x - cx
    if fdx > state.grid_width / 2:
        fdx -= state.grid_width
    elif fdx < -state.grid_width / 2:
        fdx += state.grid_width

    fdy = p.head_y - cy
    if fdy > state.grid_height / 2:
        fdy -= state.grid_height
    elif fdy < -state.grid_height / 2:
        fdy += state.grid_height

    dist_sq = fdx * fdx + fdy * fdy
    safe_r = (fog_r_grid + p.body_len * 0.5) * 1.03
    return dist_sq < safe_r**2
