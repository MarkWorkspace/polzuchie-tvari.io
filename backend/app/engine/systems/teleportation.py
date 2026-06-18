# ROLE: FSM телепортации (5 состояний).

import math
from app.engine.systems.math_utils import toroidal_distance


def update(state) -> None:
    """
    Updates teleportation FSM steps for players who are currently teleporting.
    """
    tick_interval = state.tick_interval
    base_speed = state.config.simulation.base_speed_per_second * tick_interval

    for player in state.players.values():
        if player.teleport_state == "none":
            # Clear or manage portal exit reference
            _check_exit_portal_clear(state, player)
            continue

        steps = getattr(player, "steps_this_tick", 0)
        for _ in range(steps):
            _step_player_teleport(state, player, base_speed)


def _check_exit_portal_clear(state, player) -> None:
    if player.last_portal_exited is not None:
        portal_id, ep_idx = player.last_portal_exited
        target_portal = next(
            (
                op
                for op in state.portal_manager.portal_slots
                if op is not None and op.id == portal_id
            ),
            None,
        )
        if target_portal:
            ex_x = target_portal.x2 if ep_idx == 1 else target_portal.x1
            ex_y = target_portal.y2 if ep_idx == 1 else target_portal.y1
            dist = toroidal_distance(
                player.head_x,
                player.head_y,
                ex_x,
                ex_y,
                state.grid_width,
                state.grid_height,
            )
            if dist > target_portal.radius:
                player.last_portal_exited = None
        else:
            player.last_portal_exited = None


def _step_player_teleport(state, player, base_speed: float) -> None:
    if player.teleport_state == "entering":
        _process_entering(state, player, base_speed)
    elif player.teleport_state == "in_transit":
        _process_in_transit(state, player)
    elif player.teleport_state == "exiting":
        _process_exiting(state, player, base_speed)


def _process_entering(state, player, base_speed: float) -> None:
    if player.teleport_timer <= 0:
        player.teleport_state = "exiting"
        ref_x, ref_y = player.teleport_out_pos[0], player.teleport_out_pos[1]
        dx = math.cos(player.angle) * base_speed
        dy = math.sin(player.angle) * base_speed
        new_head_x = (ref_x + dx) % state.grid_width
        new_head_y = (ref_y + dy) % state.grid_height
        if player.body_len >= player.length and player.body_len > 0:
            player.body.pop()
            player.body.pop()
        player.body.appendleft(new_head_y)
        player.body.appendleft(new_head_x)
        player.new_heads_this_tick.append(new_head_y)
        player.new_heads_this_tick.append(new_head_x)
    else:
        all_at_portal = True
        if len(player.body) >= 2:
            tail_x, tail_y = player.body[-2], player.body[-1]
            if (
                toroidal_distance(
                    tail_x,
                    tail_y,
                    player.teleport_pos["x"],
                    player.teleport_pos["y"],
                    state.grid_width,
                    state.grid_height,
                )
                >= 0.1
            ):
                all_at_portal = False

        if all_at_portal:
            player.teleport_state = "in_transit"
            new_head_x, new_head_y = (
                player.teleport_out_pos[0],
                player.teleport_out_pos[1],
            )
            player.body.clear()
            player.body.appendleft(new_head_y)
            player.body.appendleft(new_head_x)
            player.new_heads_this_tick.append(new_head_y)
            player.new_heads_this_tick.append(new_head_x)
        else:
            new_head_x, new_head_y = player.teleport_pos["x"], player.teleport_pos["y"]
            if player.body_len > 0:
                player.body.pop()
                player.body.pop()
            player.body.appendleft(new_head_y)
            player.body.appendleft(new_head_x)
            player.new_heads_this_tick.append(new_head_y)
            player.new_heads_this_tick.append(new_head_x)


def _process_in_transit(state, player) -> None:
    new_head_x, new_head_y = player.teleport_out_pos[0], player.teleport_out_pos[1]
    player.body.clear()
    player.body.appendleft(new_head_y)
    player.body.appendleft(new_head_x)
    player.new_heads_this_tick.append(new_head_y)
    player.new_heads_this_tick.append(new_head_x)
    if player.teleport_timer <= 0:
        player.teleport_state = "exiting"


def _process_exiting(state, player, base_speed: float) -> None:
    dist_to_entrance = toroidal_distance(
        player.head_x,
        player.head_y,
        player.teleport_pos["x"],
        player.teleport_pos["y"],
        state.grid_width,
        state.grid_height,
    )
    ref_x, ref_y = (
        (player.teleport_out_pos[0], player.teleport_out_pos[1])
        if dist_to_entrance < 1.0
        else (player.head_x, player.head_y)
    )

    dx = math.cos(player.angle) * base_speed
    dy = math.sin(player.angle) * base_speed
    new_head_x = (ref_x + dx) % state.grid_width
    new_head_y = (ref_y + dy) % state.grid_height

    if player.body_len >= player.length:
        all_cleared = True
        if len(player.body) >= 2:
            tail_x, tail_y = player.body[-2], player.body[-1]
            if (
                toroidal_distance(
                    tail_x,
                    tail_y,
                    player.teleport_pos["x"],
                    player.teleport_pos["y"],
                    state.grid_width,
                    state.grid_height,
                )
                < 1.0
            ):
                all_cleared = False

        if all_cleared:
            player.teleport_state = "none"
            player.teleport_pos = None
            player.teleport_out_pos = None

    if player.body_len >= player.length and player.body_len > 0:
        player.body.pop()
        player.body.pop()

    player.body.appendleft(new_head_y)
    player.body.appendleft(new_head_x)
    player.new_heads_this_tick.append(new_head_y)
    player.new_heads_this_tick.append(new_head_x)


class TeleportationSystem:
    name = "teleportation"
    order = 30
    
    def update(self, world):
        update(world)

system = TeleportationSystem()
