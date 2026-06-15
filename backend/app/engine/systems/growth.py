# ROLE: Рост/усыхание, формула сегментов.


def update(state) -> None:
    """
    Applies growth or shrinkage logic step-by-step for each player who is not teleporting.
    """
    for player in state.players.values():
        if player.teleport_state in ("entering", "exiting") or player.is_dead:
            continue

        steps = getattr(player, "steps_this_tick", 0)
        for _ in range(steps):
            _process_growth_step(state, player)


def _process_growth_step(state, player) -> None:
    if player.body_len <= state.config.snake.min_body_length:
        player.pending_growth = max(0, player.pending_growth)
        return

    cost = max(
        0.1, float(state.growth_segment_cost_func(player.score, player.body_len))
    )
    if player.score >= state.config.snake.max_growth_score:
        player.pending_growth = 0.0
        if player.body_len > 0:
            player.body.pop()
            player.body.pop()
    else:
        if player.pending_growth >= cost:
            player.pending_growth -= cost
        else:
            if player.body_len > 0:
                player.body.pop()
                player.body.pop()
            if player.pending_growth <= -cost:
                player.pending_growth += cost
                if player.body_len > state.config.snake.min_body_length:
                    player.body.pop()
                    player.body.pop()
