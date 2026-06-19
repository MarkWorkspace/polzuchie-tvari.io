# ROLE: Protobuf-упаковка, AoI-фильтрация.

import math
from collections import defaultdict
from game_config import CELL_SIZE
from app.engine.systems.visibility import get_visible_players
from app.engine.systems import snake_pb2


def populate_player_message(p_msg, player, in_aoi=True, is_full=False):
    p_msg.angle = player.angle
    p_msg.score = player.score
    p_msg.kills = player.kills
    p_msg.deaths = player.deaths
    p_msg.accelerating = player.is_accelerating_valid if in_aoi else False
    p_msg.is_dead = player.is_dead
    
    if player.teleport_state != "none":
        p_msg.teleport_state = player.teleport_state
        if player.teleport_out_pos:
            p_msg.teleport_out_x = player.teleport_out_pos[0]
            p_msg.teleport_out_y = player.teleport_out_pos[1]
            p_msg.teleport_timer_ratio = max(0.0, player.teleport_timer) / max(0.001, player.teleport_delay)
            
    if is_full:
        p_msg.skin = player.skin
        p_msg.nickname = player.nickname
        
    if is_full or player.just_respawned:
        p_msg.body.extend(player.body if in_aoi else ([player.body[0], player.body[1]] if player.body else []))
    else:
        p_msg.new_heads.extend(player.new_heads_this_tick if in_aoi else ([player.new_heads_this_tick[0], player.new_heads_this_tick[1]] if player.new_heads_this_tick else []))
        p_msg.length = player.body_len if in_aoi else 1


def prepare_cache(state) -> None:
    for p in state.players.values():
        p.new_heads_this_tick.reverse()
        p.clear_cache()

    state.full_players_cache = {}
    state.mini_players_cache = {}
    for pid, p in state.players.items():
        full_p = snake_pb2.Player()
        populate_player_message(full_p, p, in_aoi=True, is_full=False)
        state.full_players_cache[pid] = full_p

        mini_p = snake_pb2.Player()
        populate_player_message(mini_p, p, in_aoi=False, is_full=False)
        state.mini_players_cache[pid] = mini_p
        
    for p in state.players.values():
        p.just_respawned = False


def _serialize_players_data(
    state, candidates: dict, curr_visible: set, prev_visible: set, is_full: bool, players_map
) -> None:
    for pid, p in candidates.items():
        in_aoi = pid in curr_visible
        p_msg = players_map[pid]
        if is_full:
            populate_player_message(p_msg, p, in_aoi=in_aoi, is_full=True)
        else:
            if in_aoi:
                if pid not in prev_visible:
                    populate_player_message(p_msg, p, in_aoi=True, is_full=True)
                else:
                    p_msg.CopyFrom(state.full_players_cache[pid])
            else:
                p_msg.CopyFrom(state.mini_players_cache[pid])

    for pid, p in state.players.items():
        if pid not in players_map:
            p_msg = players_map[pid]
            p_msg.CopyFrom(state.mini_players_cache[pid])


def _filter_moved_foods(state, client_player, moved_foods_list):
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
    
    filtered = []
    gw, gh = state.grid_width, state.grid_height
    gw2, gh2 = gw / 2.0, gh / 2.0
    
    for f in moved_foods_list:
        dx = abs(cx - f["x"])
        if dx > gw2: dx = gw - dx
        dy = abs(cy - f["y"])
        if dy > gh2: dy = gh - dy
        
        if (dx * dx + dy * dy) < aoi_sq:
            filtered.append(f)
    return filtered


def populate_world_config(msg, cfg):
    msg.width = cfg.width
    msg.height = cfg.height
    msg.portals_enabled = cfg.portals_enabled
    msg.portals_count = cfg.portals_count
    msg.portals_radius = cfg.portals_radius
    msg.portals_teleport_delay_ms = cfg.portals_teleport_delay_ms
    msg.portals_spawn_chance = cfg.portals_spawn_chance
    msg.portals_growth_time = cfg.portals_growth_time
    msg.black_holes_enabled = cfg.black_holes_enabled
    msg.black_holes_count = cfg.black_holes_count
    msg.black_holes_spawn_chance = cfg.black_holes_spawn_chance
    msg.black_holes_pull_radius = cfg.black_holes_pull_radius
    msg.black_holes_pull_force = cfg.black_holes_pull_force
    msg.black_holes_kill_radius = cfg.black_holes_kill_radius
    msg.black_holes_growth_time = cfg.black_holes_growth_time


def populate_simulation_config(msg, cfg):
    msg.tick_rate = cfg.tick_rate
    msg.base_speed_per_second = cfg.base_speed_per_second
    msg.max_turn_speed_deg_per_second = cfg.max_turn_speed_deg_per_second
    msg.min_turn_radius = cfg.min_turn_radius
    msg.turn_radius_thickness_coeff = cfg.turn_radius_thickness_coeff
    msg.turn_idle_smoothing_at_20hz = cfg.turn_idle_smoothing_at_20hz
    msg.turn_active_smoothing_at_20hz = cfg.turn_active_smoothing_at_20hz


def populate_snake_config(msg, cfg):
    msg.base_head_radius = cfg.base_head_radius
    msg.score_thickness_scale = cfg.score_thickness_scale
    msg.camera_zoom_out_coeff = cfg.camera_zoom_out_coeff
    msg.growth_score_per_segment = str(cfg.growth_score_per_segment)
    msg.start_length = cfg.start_length
    msg.start_score = cfg.start_score
    msg.min_body_length = cfg.min_body_length
    msg.safe_spawn_distance = cfg.safe_spawn_distance
    msg.max_growth_score = cfg.max_growth_score


def populate_visual_config(msg, cfg):
    msg.min_fog_radius = cfg.min_fog_radius
    msg.fog_score_expansion_coeff = cfg.fog_score_expansion_coeff
    msg.camera_base_zoom = cfg.camera_base_zoom
    msg.camera_pitch_angle = cfg.camera_pitch_angle
    msg.camera_z_height = cfg.camera_z_height
    msg.camera_y_offset = cfg.camera_y_offset
    msg.mouse_sensitivity = cfg.mouse_sensitivity
    msg.head_glow_radius = cfg.head_glow_radius


def populate_food_config(msg, cfg):
    msg.base_radius = cfg.base_radius
    msg.radius_value_scale = cfg.radius_value_scale
    msg.death_drop_score_fraction = cfg.death_drop_score_fraction
    msg.attraction_radius = cfg.attraction_radius
    msg.attraction_speed = cfg.attraction_speed
    for tc in cfg.types:
        tc_msg = msg.types.add()
        tc_msg.value = tc.value
        tc_msg.weight = tc.weight
        tc_msg.color = tc.color
        tc_msg.image = tc.image or ""


def _populate_configs(frame, config):
    populate_world_config(frame.server_world, config.world)
    populate_simulation_config(frame.server_simulation, config.simulation)
    populate_snake_config(frame.server_snake, config.snake)
    populate_visual_config(frame.server_visual, config.visual)
    populate_food_config(frame.server_food, config.food)


def _assemble_entities(frame, state, client_id):
    for nf in state.food_manager.new_foods:
        f_msg = frame.new_foods.add()
        f_msg.id, f_msg.x, f_msg.y, f_msg.value, f_msg.color, f_msg.image = nf["id"], nf["x"], nf["y"], nf["value"], nf["color"], nf.get("image", "")

    frame.eaten_foods.extend(state.food_manager.eaten_foods)

    moved_foods_list = list(state.food_manager.moved_foods.values())
    if client_id and client_id in state.players:
        moved_foods_list = _filter_moved_foods(state, state.players[client_id], moved_foods_list)
    for mf in moved_foods_list:
        mf_msg = frame.moved_foods.add()
        mf_msg.id, mf_msg.x, mf_msg.y = mf["id"], mf["x"], mf["y"]

    for ke in state.kill_events:
        ke_msg = frame.kill_events.add()
        ke_msg.killer, ke_msg.victim = ke["killer"] or "", ke["victim"]

    for t in state.tombstones:
        t_msg = frame.tombstones.add()
        t_msg.id, t_msg.x, t_msg.y, t_msg.nickname, t_msg.time_left = t["id"], t["x"], t["y"], t["nickname"] or "", t["time_left"]


def _assemble_structures(frame, state):
    for p in state.portal_manager.get_cached_list():
        p_msg = frame.portals.add()
        p_msg.id, p_msg.color, p_msg.x1, p_msg.y1, p_msg.x2, p_msg.y2, p_msg.radius, p_msg.current_scale = p["id"], p["color"], p["x1"], p["y1"], p["x2"], p["y2"], p["radius"], p["current_scale"]

    for bh in state.bh_manager.get_cached_list():
        bh_msg = frame.black_holes.add()
        bh_msg.id, bh_msg.x, bh_msg.y, bh_msg.pull_radius, bh_msg.kill_radius = str(bh["id"]), bh["x"], bh["y"], bh["pull_radius"], bh["kill_radius"]


def _assemble_final_frame(state, is_full: bool, client_id: str = None) -> snake_pb2.GameStateFrame:
    frame = snake_pb2.GameStateFrame()
    frame.type = snake_pb2.GameStateFrame.FrameType.FULL if is_full else snake_pb2.GameStateFrame.FrameType.DELTA
    frame.server_tick_rate = state.config.simulation.tick_rate
    
    _assemble_entities(frame, state, client_id)
    _assemble_structures(frame, state)

    if is_full or getattr(state, "_config_broadcast_needed", False):
        _populate_configs(frame, state.config)

    return frame


def get_delta_state(
    state,
    client_id,
    is_full=False,
    update_visibility=True,
    return_visibility=False,
    serialize_proto=False,
):
    prev_visible = state.client_visibility.get(client_id, set())
    curr_visible, candidates = get_visible_players(state, client_id)

    frame = _assemble_final_frame(state, is_full, client_id)
    _serialize_players_data(
        state, candidates, curr_visible, prev_visible, is_full, frame.players
    )

    if client_id and update_visibility:
        state.client_visibility[client_id] = curr_visible

    final_state = frame.SerializeToString() if serialize_proto else frame
    return (final_state, curr_visible) if return_visibility else final_state


def get_full_state(state, client_id, serialize_proto=False):
    frame, curr_visible = get_delta_state(
        state,
        client_id,
        is_full=True,
        update_visibility=False,
        return_visibility=True,
        serialize_proto=False,
    )
    frame.your_id = client_id
    for f in state.food_manager.foods.values():
        f_msg = frame.foods.add()
        f_msg.id = f.id
        f_msg.x = f.x
        f_msg.y = f.y
        f_msg.value = f.value
        f_msg.color = f.color
        f_msg.image = f.image or ""
        
    return frame.SerializeToString() if serialize_proto else frame


class SerializationSystem:
    name = "serialization"
    order = 80
    
    def update(self, world):
        prepare_cache(world)

system = SerializationSystem()
