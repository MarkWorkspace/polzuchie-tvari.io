# ROLE: MsgPack-упаковка, AoI-фильтрация, placeholder-замена.

import math
import msgpack
from collections import defaultdict

from game_config import CELL_SIZE
from app.engine.systems.visibility import get_visible_players


def prepare_cache(state) -> None:
    """
    Pre-packs player dictionary and MsgPack states and populates player_grid for network filtering.
    """
    for p in state.players.values():
        p.new_heads_this_tick.reverse()
        p.clear_cache()

    _cache_player_dicts(state)

    for p in state.players.values():
        p.just_respawned = False


def _cache_player_dicts(state) -> None:
    state.full_players_dict = {
        pid: p.to_dict(in_aoi=True, is_full=False) for pid, p in state.players.items()
    }
    state.mini_players_dict = {
        pid: p.to_dict(in_aoi=False, is_full=False) for pid, p in state.players.items()
    }




def get_delta_state(
    state,
    client_id,
    is_full=False,
    update_visibility=True,
    return_visibility=False,
    serialize_msgpack=False,
):
    prev_visible = state.client_visibility.get(client_id, set())
    curr_visible, candidates = get_visible_players(state, client_id)

    players_data = _serialize_players_data(
        state, candidates, curr_visible, prev_visible, is_full
    )
    final_dict = _assemble_final_dict(state, players_data, is_full, client_id)

    final_state = msgpack.packb(final_dict) if serialize_msgpack else final_dict

    if client_id and update_visibility:
        state.client_visibility[client_id] = curr_visible

    return (final_state, curr_visible) if return_visibility else final_state


def _serialize_players_data(
    state, candidates: dict, curr_visible: set, prev_visible: set, is_full: bool
) -> dict:
    data = {}
    for pid, p in candidates.items():
        in_aoi = pid in curr_visible
        if is_full:
            data[pid] = p.to_dict(in_aoi=in_aoi, is_full=True)
        else:
            if in_aoi:
                data[pid] = (
                    p.to_dict(in_aoi=True, is_full=True)
                    if pid not in prev_visible
                    else state.full_players_dict.get(
                        pid, p.to_dict(in_aoi=True, is_full=False)
                    )
                )
            else:
                data[pid] = state.mini_players_dict.get(
                    pid, p.to_dict(in_aoi=False, is_full=False)
                )

    for pid in state.players:
        if pid not in data:
            p = state.players[pid]
            data[pid] = state.mini_players_dict.get(
                pid, p.to_dict(in_aoi=False, is_full=False)
            )
    return data


def _assemble_final_dict(state, players_data: dict, is_full: bool, client_id: str = None) -> dict:
    from app.engine.systems.math_utils import toroidal_delta

    cfg = getattr(state, "_cached_config_dict", None) or state.config.to_dict()

    moved_foods_list = list(state.food_manager.moved_foods.values())
    if client_id and client_id in state.players:
        client_player = state.players[client_id]
        if client_player.body_len > 0:
            cx, cy = client_player.head_x, client_player.head_y
            eff_score = max(0, client_player.body_len - state.config.snake.start_length) * 10.0
        else:
            cx, cy = state.grid_width / 2, state.grid_height / 2
            eff_score = 0
            
        fog_r_world = (
            state.config.visual.min_fog_radius
            + eff_score * state.config.visual.fog_score_expansion_coeff
        )
        fog_r_grid = fog_r_world / 20.0
        aoi_sq = (fog_r_grid * 1.5) ** 2
        
        filtered_moved_foods = []
        gw = state.grid_width
        gh = state.grid_height
        gw2 = gw / 2.0
        gh2 = gh / 2.0
        
        for f in moved_foods_list:
            dx = abs(cx - f['x'])
            if dx > gw2: dx = gw - dx
            dy = abs(cy - f['y'])
            if dy > gh2: dy = gh - dy
            
            if (dx * dx + dy * dy) < aoi_sq:
                filtered_moved_foods.append(f)
        moved_foods_list = filtered_moved_foods

    final_dict = {
        "type": "FULL" if is_full else "DELTA",
        "server_tick_rate": state.config.simulation.tick_rate,
        "players": players_data,
        "new_foods": state.food_manager.new_foods,
        "eaten_foods": state.food_manager.eaten_foods,
        "moved_foods": moved_foods_list,
        "kill_events": state.kill_events,
        "tombstones": state.tombstones,
        "portals": state.portal_manager.get_cached_list(),
        "black_holes": state.bh_manager.get_cached_list(),
    }
    if is_full or getattr(state, "_config_broadcast_needed", False):
        for k in ("world", "simulation", "snake", "visual", "food"):
            final_dict[f"server_{k}"] = cfg[k]
    return final_dict


def get_full_state(state, client_id):
    full_state = get_delta_state(state, client_id, is_full=True)
    full_state["foods"] = [f.to_dict() for f in state.food_manager.foods.values()]
    return full_state


class SerializationSystem:
    name = "serialization"
    order = 80
    
    def update(self, world):
        prepare_cache(world)

system = SerializationSystem()
