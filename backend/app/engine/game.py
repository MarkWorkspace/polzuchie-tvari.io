# ROLE: Оркестратор тика — только вызывает системы по порядку. Не содержит игровой логики.

from app.engine.registry import registry

# Auto-discover all systems inside app.engine.systems
registry.autodiscover()

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
    state.bh_manager.update(tick_interval)

    # Run the systems sequentially using the registry
    registry.update_all(state)

    state.food_manager.ensure_target_count()
