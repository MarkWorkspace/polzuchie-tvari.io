# ROLE: Единые детерминированные сценарии мира для parity-тестов и генератора фикстур.
# ЕДИНСТВЕННАЯ копия сценариев — используется и generate_frame_fixtures.py, и test_frame_parity.py.
# Изменение здесь ОЖИДАЕМО ведёт к перегенерации фикстур (см. tests_shared/golden_frames/).

import os
import random
from dataclasses import dataclass
from pathlib import Path

from app.engine.state import World
from app.engine.systems import snake_pb2
from app.engine.systems.math_utils import wrap_coordinate

SEED = 42
CLIENT_ID = "player_aoi"
EMPTY_CLIENT_ID = "empty_client"
AOI_TICKS = 2  # тики до FULL-кадра
DELTA_TICKS = 1  # тики до DELTA-кадра
PINNED_CONFIG_PATH = Path(__file__).resolve().parent / "fixtures" / "config_parity.json"

SCENARIO_DEFAULT = "default"
SCENARIO_EMPTY = "empty"
SCENARIOS = (SCENARIO_DEFAULT, SCENARIO_EMPTY)
# Первый сценарий сохраняет исторические имена frame_full/frame_delta.
SCENARIO_FIXTURE_PREFIX = {
    SCENARIO_DEFAULT: "frame",
    SCENARIO_EMPTY: "frame_empty",
}

# Дальние точки сценария: за пределами AoI клиента (fog 25 grid + запас тела).
POS_CLIENT = (2.0, 50.0)
POS_FAR = (5.0, 5.0)
POS_NEW = (90.0, 90.0)
POS_DEAD = (5.0, 55.0)
POS_TELEPORT = (4.0, 47.0)
POS_EDGE = (1.0, 53.0)  # тело уходит через левый шов и содержит width-1
POS_ENTER = (60.0, 50.0)  # до FULL вне AoI
POS_ENTER_DELTA = (2.0, 70.0)  # после FULL входит в AoI
POS_DIES = (6.0, 58.0)

TELEPORT_OUT_POS = (70.0, 70.0)
TELEPORT_TIMER = 1.0
TELEPORT_DELAY = 2.0


@dataclass(frozen=True)
class ScenarioFrames:
    """FULL/DELTA одного сценария и фактическая видимость на каждом кадре."""

    name: str
    world: World
    full_frame: snake_pb2.GameStateFrame
    delta_frame: snake_pb2.GameStateFrame
    full_bodies: dict[str, tuple[float, ...]]
    full_visible: frozenset[str]
    delta_visible: frozenset[str]


def scenario_names() -> tuple[str, ...]:
    return SCENARIOS


def fixture_prefix(scenario: str) -> str:
    return SCENARIO_FIXTURE_PREFIX[scenario]


def _set_player_pos(player, x: float, y: float) -> None:
    """Перенести тело игрока в (x, y) с прямой начальной геометрией.

    Сегменты заворачиваются по ширине карты тем же правилом, что и
    `Player.respawn`, поэтому голова остаётся первой, а тело не выходит
    за шов.
    """
    player.body.clear()
    start_len = player.config.snake.start_length
    width = player.config.world.width
    for i in range(start_len):
        player.body.append(wrap_coordinate(x - i, width))
        player.body.append(y)
    player.angle = 0.0


def _pinned_world() -> World:
    """Создать World на pinned-конфиге и вернуть CONFIG_PATH вызывающему.

    Parity-сценарии всегда читают pinned-конфиг, а не live runtime
    `backend/config.json`, даже если тест или генератор передали другой
    CONFIG_PATH. Последующие записи конфига направляются в вызывающий
    CONFIG_PATH (или в pinned-путь, если он не был задан), чтобы
    `update_config()` не мог перезаписать pinned-фикстуру.
    """
    previous_config_path = os.environ.get("CONFIG_PATH")
    os.environ["CONFIG_PATH"] = str(PINNED_CONFIG_PATH)
    try:
        world = World()
    finally:
        if previous_config_path is None:
            os.environ.pop("CONFIG_PATH", None)
        else:
            os.environ["CONFIG_PATH"] = previous_config_path

    world.config_file_path = (
        previous_config_path if previous_config_path is not None else str(PINNED_CONFIG_PATH)
    )
    return world


def build_deterministic_world() -> World:
    """Построить воспроизводимый мир с игроками всех golden-сценариев.

    Позиции подобраны так, чтобы:
    - player_aoi/player_edge/player_teleport/player_dies были в AoI клиента;
    - player_far/player_new/player_enter были вне AoI на FULL;
    - тело player_edge заворачивалось через шов и содержало width-1;
    - player_dead уже был мёртв (пустое тело + final_length > 0).

    Смерть player_dies и вход player_enter в AoI применяются в
    build_scenario_frames() между FULL и DELTA, чтобы delta-фикстура
    покрывала переходы.
    """
    random.seed(SEED)
    world = _pinned_world()

    world.add_player(CLIENT_ID, nickname="InAoI", skin="#ff0000")
    world.add_player("player_far", nickname="FarAway", skin="#00ff00")
    world.add_player("player_new", nickname="JustSpawned", skin="#0000ff")
    world.add_player("player_dead", nickname="Dead", skin="#ffaa00")
    world.add_player("player_teleport", nickname="Teleporting", skin="#aa00ff")
    world.add_player("player_edge", nickname="EdgeSpawn", skin="#00ffff")
    world.add_player("player_enter", nickname="EnteringAoI", skin="#ff00ff")
    world.add_player("player_dies", nickname="DiesThisTick", skin="#888888")

    _set_player_pos(world.players[CLIENT_ID], *POS_CLIENT)
    _set_player_pos(world.players["player_far"], *POS_FAR)
    _set_player_pos(world.players["player_new"], *POS_NEW)
    _set_player_pos(world.players["player_dead"], *POS_DEAD)
    _set_player_pos(world.players["player_teleport"], *POS_TELEPORT)
    _set_player_pos(world.players["player_edge"], *POS_EDGE)
    _set_player_pos(world.players["player_enter"], *POS_ENTER)
    _set_player_pos(world.players["player_dies"], *POS_DIES)

    # player_dead мёртв с самого начала: FULL и DELTA проверяют ветку final_length.
    dead = world.players["player_dead"]
    dead.is_dead = True
    dead.deaths = 1
    dead.score = 12
    dead.final_length = 17
    dead.body.clear()
    dead.new_heads_this_tick = []

    return world


def _build_empty_world() -> World:
    """Мир без игроков: FULL/DELTA с пустой map players."""
    random.seed(SEED)
    return _pinned_world()


def _prepare_teleport_for_full(world: World) -> None:
    """Зафиксировать in_transit в FULL до того, как FSM свернёт тело.

    В следующем тике teleportation FSM перенесёт голову в teleport_out_pos
    и оставит в DELTA только exit-точку — это и есть проверяемый переход.
    """
    player = world.players["player_teleport"]
    player.teleport_state = "in_transit"
    player.teleport_pos = {"x": player.head_x, "y": player.head_y}
    player.teleport_out_pos = TELEPORT_OUT_POS
    player.teleport_timer = TELEPORT_TIMER
    player.teleport_delay = TELEPORT_DELAY
    player.length = player.body_len


def _apply_delta_transitions(world: World) -> None:
    """Изменения между FULL и DELTA: respawn, вход в AoI и смерть."""
    # player_new появляется заново после FULL: DELTA обязана использовать
    # body-ветку just_respawned, а не new_heads.
    world.players["player_new"].respawn(*POS_NEW)

    # player_enter был вне AoI на FULL, теперь входит в зону видимости:
    # DELTA должна отправить полное тело, а не mini-точку.
    _set_player_pos(world.players["player_enter"], *POS_ENTER_DELTA)

    # player_dies умирает между FULL и DELTA: тело очищается, final_length
    # сохраняет длину прошлой жизни, длина кадра становится 0.
    dying = world.players["player_dies"]
    dying.final_length = dying.body_len
    dying.deaths += 1
    dying.is_dead = True
    dying.body.clear()
    dying.new_heads_this_tick = []


def build_scenario_frames(scenario: str = SCENARIO_DEFAULT) -> ScenarioFrames:
    """Построить FULL и DELTA для одного именованного сценария.

    Состояние DELTA продолжает FULL: FULL строится на тике AOI_TICKS,
    затем применяются переходы сценария и выполняется DELTA_TICKS тиков.
    """
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown frame scenario: {scenario!r}")
    from app.engine.systems.serialization import build_full_frame, get_delta_state

    world = _build_empty_world() if scenario == SCENARIO_EMPTY else build_deterministic_world()
    client_id = EMPTY_CLIENT_ID if scenario == SCENARIO_EMPTY else CLIENT_ID

    for _ in range(AOI_TICKS):
        world.tick()

    if scenario == SCENARIO_DEFAULT:
        _prepare_teleport_for_full(world)

    full_frame, full_visible = build_full_frame(world, client_id, return_visibility=True)
    # Snapshot the exact pre-DELTA bodies: tests need head-first/wrap assertions
    # against the FULL tick, not against the world advanced by DELTA_TICKS.
    full_bodies = {pid: tuple(player.body) for pid, player in world.players.items()}
    # DELTA строится относительно того, что клиент реально видел в FULL.
    world.client_visibility[client_id] = set(full_visible)

    if scenario == SCENARIO_DEFAULT:
        _apply_delta_transitions(world)

    for _ in range(DELTA_TICKS):
        world.tick()

    delta_frame, delta_visible = get_delta_state(
        world,
        client_id,
        is_full=False,
        serialize_proto=False,
        return_visibility=True,
    )

    return ScenarioFrames(
        name=scenario,
        world=world,
        full_frame=full_frame,
        delta_frame=delta_frame,
        full_bodies=full_bodies,
        full_visible=frozenset(full_visible),
        delta_visible=frozenset(delta_visible),
    )


def build_full_and_delta_world(scenario: str = SCENARIO_DEFAULT):
    """Backward-compatible tuple API: (world, full_frame, delta_frame)."""
    frames = build_scenario_frames(scenario)
    return frames.world, frames.full_frame, frames.delta_frame
