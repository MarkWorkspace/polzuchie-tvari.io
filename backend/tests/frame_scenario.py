# ROLE: Единый детерминированный сценарий мира для parity-тестов и генератора фикстур.
# ЕДИНСТВЕННАЯ копия сценария — используется и generate_frame_fixtures.py, и test_frame_parity.py.
# Изменение здесь ОЖИДАЕМО ведёт к перегенерации фикстур (см. README в tests_shared/golden_frames/).

import random

from app.engine.state import World

SEED = 42
CLIENT_ID = "player_aoi"
AOI_TICKS = 2  # тики до FULL-кадра
DELTA_TICKS = 1  # тики до DELTA-кадра


def _set_player_pos(player, x: float, y: float) -> None:
    """Перенести тело игрока в (x, y) с прямой начальной геометрией."""
    player.body.clear()
    start_len = player.config.snake.start_length
    for i in range(start_len):
        player.body.append(x - i)
        player.body.append(y)
    player.angle = 0.0


def build_deterministic_world() -> World:
    """Построить воспроизводимый мир с тремя игроками в известных позициях."""
    random.seed(SEED)
    world = World()

    world.add_player("player_aoi", nickname="InAoI", skin="#ff0000")
    world.add_player("player_far", nickname="FarAway", skin="#00ff00")
    world.add_player("player_new", nickname="JustSpawned", skin="#0000ff")

    _set_player_pos(world.players["player_aoi"], 50.0, 50.0)
    _set_player_pos(world.players["player_far"], 5.0, 5.0)
    _set_player_pos(world.players["player_new"], 90.0, 90.0)
    return world


def build_full_and_delta_world():
    """
    Возвращает (world, full_frame, delta_frame), где FULL и DELTA построены
    из одной и той же последовательности тиков. Состояние delta-мира
    продолжает состояние full-мира (DELTA ссылается на FULL как на previous).
    """
    from app.engine.systems.serialization import (
        get_delta_state,
        get_full_state,
    )

    world = build_deterministic_world()
    for _ in range(AOI_TICKS):
        world.tick()

    full_frame = get_full_state(world, CLIENT_ID, serialize_proto=False)

    # DELTA-кадр должен строиться поверх того же мира и видимости, что FULL.
    world.client_visibility[CLIENT_ID] = set(world.players.keys())
    for _ in range(DELTA_TICKS):
        world.tick()
    delta_frame = get_delta_state(
        world, CLIENT_ID, is_full=False, serialize_proto=False
    )

    return world, full_frame, delta_frame
