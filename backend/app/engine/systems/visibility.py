# ROLE: Расчёт зоны видимости (Area of Interest - AoI) и фильтрация игроков.

from app.engine.systems.math_utils import toroidal_distance


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

    current_visible = set()
    for pid, p in state.players.items():
        if p.body_len > 0:
            if pid == client_id:
                current_visible.add(pid)
                continue

            dist = toroidal_distance(
                cx, cy, p.head_x, p.head_y, state.grid_width, state.grid_height
            )
            safe_r = (fog_r_grid + p.body_len * 0.5) * 1.03
            if dist < safe_r:
                current_visible.add(pid)

    return current_visible, state.players
