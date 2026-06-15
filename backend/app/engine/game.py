# ROLE: Оркестратор тика — только вызывает системы по порядку. Не содержит игровой логики.

from app.engine.systems import (
    physics,
    collision,
    teleportation,
    gravity,
    food_eating,
    boost,
    growth,
    serialization,
)


def tick(state) -> None:
    """
    Executes a single server tick by delegating to engine systems in sequence.
    """
    state._config_broadcast_needed = state._config_updated_this_tick
    state._config_updated_this_tick = False

    state.food_manager.tick_start()
    state.kill_events = []

    tick_interval = state.tick_interval
    state.food_manager.update_moving_food(tick_interval)
    state.food_manager.update_clusters(tick_interval)
    state.portal_manager.update(tick_interval)

    # Run the systems sequentially as per Rule 6
    physics.update(state)
    collision.check(state)
    teleportation.update(state)

    state.food_grid = food_eating.build_food_grid(state)

    gravity.update(state)
    food_eating.update(state)
    boost.update(state)
    growth.update(state)

    state.food_manager.ensure_target_count()
    serialization.prepare_cache(state)
