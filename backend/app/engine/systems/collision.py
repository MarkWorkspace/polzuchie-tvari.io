# ROLE: Столкновения змейка-змейка (коэфф. 0.95). Не движение, не еда.

import math
from app.engine.systems.math_utils import toroidal_delta, toroidal_distance
from game_config import CELL_SIZE


def check(state) -> None:
    state.collision_grid.clear()

    active_players = []
    for pid, player in state.players.items():
        if not player.body or player.teleport_state == "in_transit" or player.is_dead:
            continue
        active_players.append((pid, player))

    _populate_collision_grid(state, active_players)

    dead_players = set()
    for pid, player in active_players:
        is_dead, killer_pid = _check_collision_for_player(
            state, pid, player, dead_players
        )
        if is_dead:
            dead_players.add(pid)
            _process_player_death(state, pid, player, killer_pid)

    dt = state.tick_interval
    if state.tombstones:
        state.tombstones = [t for t in state.tombstones if t["time_left"] > dt]
    for t in state.tombstones:
        t["time_left"] -= dt


def _populate_collision_grid(state, active_players) -> None:
    for tomb in state.tombstones:
        # Arming time: don't become solid for the first 1.5 seconds
        # so the survivor has time to slither away from the death site.
        if tomb["time_left"] > 58.5:
            continue
        cx = int(tomb["x"] / CELL_SIZE) % state._grid_width_cells
        cy = int(tomb["y"] / CELL_SIZE) % state._grid_height_cells
        state.collision_grid[(cx, cy)].append(("tombstone", tomb["x"], tomb["y"], 1.2))

    for pid, player in active_players:
        radius = player.head_radius
        for i in range(0, len(player.body), 2):
            pt_x, pt_y = player.body[i], player.body[i + 1]
            cx = int(pt_x / CELL_SIZE) % state._grid_width_cells
            cy = int(pt_y / CELL_SIZE) % state._grid_height_cells
            state.collision_grid[(cx, cy)].append((pid, pt_x, pt_y, radius))


def _check_collision_for_player(
    state, pid: str, player, dead_players: set
) -> tuple[bool, str | None]:
    hx, hy = player.head_x, player.head_y
    head_radius = player.head_radius
    gcx = int(hx / CELL_SIZE) % state._grid_width_cells
    gcy = int(hy / CELL_SIZE) % state._grid_height_cells

    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            cell = (
                (gcx + dx) % state._grid_width_cells,
                (gcy + dy) % state._grid_height_cells,
            )
            if cell not in state.collision_grid:
                continue
            for other_pid, seg_x, seg_y, other_radius in state.collision_grid[cell]:
                if other_pid == pid or other_pid in dead_players:
                    continue
                fdx, fdy = toroidal_delta(
                    hx, hy, seg_x, seg_y, state.grid_width, state.grid_height
                )
                if fdx * fdx + fdy * fdy < (head_radius + other_radius * 0.8) ** 2:
                    return True, other_pid
    return False, None


def _process_player_death(state, pid: str, player, killer_pid: str | None) -> None:
    if killer_pid and killer_pid in state.players:
        state.players[killer_pid].kills += 1
    player.deaths += 1
    state.kill_events.append({"killer": killer_pid, "victim": pid})
    state.food_manager.drop_food_on_death(player)

    spawn_tombstone = True
    if hasattr(state, "portal_manager") and state.portal_manager:
        for p in state.portal_manager.portal_slots:
            if p is not None and p.state != "dead":
                eff_radius = p.radius * p.current_scale
                dist1 = toroidal_distance(player.head_x, player.head_y, p.x1, p.y1, state.grid_width, state.grid_height)
                dist2 = toroidal_distance(player.head_x, player.head_y, p.x2, p.y2, state.grid_width, state.grid_height)
                if dist1 < eff_radius or dist2 < eff_radius:
                    spawn_tombstone = False
                    break

    if player.body and spawn_tombstone:
        state.tombstones.append(
            {
                "id": f"tomb_{pid}_{len(state.kill_events)}",
                "x": player.head_x,
                "y": player.head_y,
                "nickname": player.nickname or "Игрок",
                "time_left": 60.0,
            }
        )

    player.is_dead = True
    player.body.clear()
