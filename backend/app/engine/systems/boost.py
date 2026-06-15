# ROLE: Ускорение, потеря массы, спавн еды при бусте.

import random


def update(state) -> None:
    """
    Applies speed multipliers and drains mass/drops food for accelerating players.
    """
    tick_interval = state.tick_interval
    boost_cfg = state.config.boost

    for player in state.players.values():
        is_accelerating = player.is_accelerating_valid
        player.speed_mult = boost_cfg.speed_multiplier if is_accelerating else 1.0

        if is_accelerating:
            _apply_boost_drain(state, player, tick_interval, boost_cfg)
        else:
            player.boost_drop = 0.0


def _apply_boost_drain(state, player, tick_interval: float, boost_cfg) -> None:
    player.boost_drop += tick_interval
    if player.boost_drop >= boost_cfg.drain_interval_seconds:
        player.boost_drop -= boost_cfg.drain_interval_seconds
        drain = boost_cfg.drain_per_interval
        player.score = max(0, player.score - drain)
        player.pending_growth -= drain

        if player.body_len > 0:
            tx = (player.body[-2] + random.uniform(-0.5, 0.5)) % state.grid_width
            ty = (player.body[-1] + random.uniform(-0.5, 0.5)) % state.grid_height
            state.food_manager.spawn_specific_food(tx, ty, boost_cfg.food_drop_value)
            state.food_manager.trim_overflow()
