# ROLE: Движение, тороидальное оборачивание. Не коллизии.

import math


def update(state) -> None:
    """
    Updates all players' angles and moves their heads based on their speed and inputs.
    """
    tick_interval = state.tick_interval
    base_speed = state.config.simulation.base_speed_per_second * tick_interval
    max_turn_deg_rad = (
        state.config.simulation.max_turn_speed_deg_per_second * math.pi / 180
    )
    min_turn_radius_cfg = state.config.simulation.min_turn_radius
    thickness_coeff = state.config.simulation.turn_radius_thickness_coeff
    idle_turn_smoothing = state.tick_smoothing(
        state.config.simulation.turn_idle_smoothing_at_20hz
    )
    active_turn_smoothing = state.tick_smoothing(
        state.config.simulation.turn_active_smoothing_at_20hz
    )

    for player in state.players.values():
        if player.is_dead:
            continue
        player.new_heads_this_tick = []
        if player.teleport_state in ("entering", "in_transit"):
            player.teleport_timer = max(0.0, player.teleport_timer - tick_interval)

        effective_radius = min_turn_radius_cfg + player.head_radius * thickness_coeff
        max_turn_from_radius = state.config.simulation.base_speed_per_second / max(
            effective_radius, 0.01
        )
        turn_speed = min(max_turn_deg_rad, max_turn_from_radius) * tick_interval

        player.pending_steps += player.speed_mult
        steps_this_tick = int(player.pending_steps)
        
        max_steps = getattr(state.config.simulation, 'max_steps_per_tick', 4)
        if steps_this_tick > max_steps:
            steps_this_tick = max_steps
            player.pending_steps = float(max_steps)

        player.pending_steps -= steps_this_tick
        player.steps_this_tick = steps_this_tick

        # TURN ONCE PER TICK
        if player.teleport_state in ("none", "exiting"):
            target_turn = player.turn * turn_speed
            if getattr(player, "steered_by_mouse", False):
                player.current_turn = target_turn
            else:
                if player.turn == 0:
                    player.current_turn += (0 - player.current_turn) * idle_turn_smoothing
                else:
                    player.current_turn += (target_turn - player.current_turn) * active_turn_smoothing
            player.angle += player.current_turn
        else:
            player.current_turn = 0.0

        # Apply gravity bend from black holes ONCE PER TICK
        if player.body_len > 0:
            bend_angle = state.bh_manager.get_gravity_bend(
                {"x": player.head_x, "y": player.head_y}, player.angle, state.tick_interval
            )
            player.angle += bend_angle

        for _ in range(steps_this_tick):
            _step_player_physics(
                state,
                player,
                base_speed,
            )


def _step_player_physics(
    state,
    player,
    base_speed: float,
) -> None:

    # Apply gravity bend from black holes
    if player.body_len > 0:
        bend_angle = state.bh_manager.get_gravity_bend(
            {"x": player.head_x, "y": player.head_y}, player.angle, state.tick_interval
        )
        player.angle += bend_angle

    # Basic movement
    if player.teleport_state == "none" and player.body_len > 0:
        dx = math.cos(player.angle) * base_speed
        dy = math.sin(player.angle) * base_speed
        new_head_x = (player.head_x + dx) % state.grid_width
        new_head_y = (player.head_y + dy) % state.grid_height

        # Check portal entry
        tp_check = state.portal_manager.check_teleport_start(
            {"x": new_head_x, "y": new_head_y}, player
        )
        if tp_check:
            player.teleport_state = "entering"
            player.length = player.body_len
            player.teleport_pos = {"x": new_head_x, "y": new_head_y}
            player.teleport_out_pos = tp_check["out_pos"]
            player.last_portal_exited = tp_check["portal_id"]
            player.teleport_delay = (
                state.config.world.portals_teleport_delay_ms / 1000.0
            )
            player.teleport_timer = player.teleport_delay

        player.body.appendleft(new_head_y)
        player.body.appendleft(new_head_x)
        player.new_heads_this_tick.append(new_head_y)
        player.new_heads_this_tick.append(new_head_x)


class PhysicsSystem:
    name = "physics"
    order = 10
    
    def update(self, world):
        update(world)

system = PhysicsSystem()
