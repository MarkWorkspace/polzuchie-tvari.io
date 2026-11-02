# ROLE: Parity-тест сетевого кадра. Ловит дрейф серверной сериализации:
# пересчитывает кадры всех сценариев (frame_scenario) и сравнивает с ЗАКОММИЧЕННЫМИ
# эталонами .expected.json. Также сверяет содержимое с закоммиченными .bin по
# каноническому НЕСЖАТОМУ protobuf.
# .bin — сжатая транспортная фикстура (для decoder round-trip), а не эталон zlib-байтов.

import asyncio
import json
import math
import os
import zlib

import pytest
from google.protobuf.json_format import MessageToDict

import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import server
from app.engine.systems import snake_pb2
from app.engine.systems.serialization import populate_player_message
from tests.frame_scenario import (
    AOI_TICKS,
    CLIENT_ID,
    DELTA_TICKS,
    SCENARIO_DEFAULT,
    SCENARIO_EMPTY,
    build_deterministic_world,
    build_scenario_frames,
    fixture_prefix,
    scenario_names,
)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames")


def _load_bin(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


def _load_json(name: str) -> dict:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return json.load(f)


def _load_committed_frame(name: str) -> "snake_pb2.GameStateFrame":
    """Развернуть сжатый транспортный .bin фикстуры в protobuf-сообщение.

    .bin хранится сжатым (как кадр идёт по сети) и нужен для decoder
    round-trip. Его сжатые байты не являются эталоном: zlib сжимает
    по-разному на разных платформах/версиях.
    """
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(zlib.decompress(_load_bin(name)))
    return frame


def _canonical_proto_bytes(frame: "snake_pb2.GameStateFrame") -> bytes:
    """Несжатые protobuf-байты с детерминированным порядком map-полей.

    Устойчивы к версии/платформе zlib и к недетерминированному порядку
    map-полей в исходном .bin.
    """
    return frame.SerializeToString(deterministic=True)


def _assert_protobuf_matches_committed(frame: "snake_pb2.GameStateFrame", bin_name: str) -> None:
    committed = _load_committed_frame(bin_name)
    assert _canonical_proto_bytes(frame) == _canonical_proto_bytes(committed), (
        f"{bin_name} разошёлся с кодом по несжатому protobuf. Перезапустите "
        "generate_frame_fixtures.py и закоммитьте обновлённые фикстуры "
        "(ОСОЗНАННО, проверив diff)."
    )


def _round_floats(val):
    if isinstance(val, float):
        return round(val, 2)
    if isinstance(val, dict):
        return {k: _round_floats(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_round_floats(v) for v in val]
    return val


def _deep_approx_equal(a, b, path="root", tol=0.01):
    if isinstance(a, dict) and isinstance(b, dict):
        assert set(a.keys()) == set(b.keys()), (
            f"Дрейф ключей на {path}: только в коде {set(a) - set(b)}, "
            f"только в эталоне {set(b) - set(a)}"
        )
        for k in a:
            _deep_approx_equal(a[k], b[k], f"{path}.{k}", tol)
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b), f"Дрейф длины на {path}: код={len(a)} эталон={len(b)}"
        for i in range(len(a)):
            _deep_approx_equal(a[i], b[i], f"{path}[{i}]", tol)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        assert math.isclose(float(a), float(b), abs_tol=tol), (
            f"Числовой дрейф на {path}: код={a} эталон={b}"
        )
    else:
        assert a == b, f"Дрейф значения на {path}: код={a!r} эталон={b!r}"


def _frame_to_norm_dict(frame: "snake_pb2.GameStateFrame") -> dict:
    d = MessageToDict(frame, preserving_proto_field_name=True)
    return json.loads(json.dumps(_round_floats(d), sort_keys=True))


@pytest.fixture(scope="module")
def fresh_default_scenario():
    """Пересчитать FULL и DELTA default-сценария из текущего кода."""
    return build_scenario_frames(SCENARIO_DEFAULT)


@pytest.fixture(scope="module")
def fresh_world_frames(fresh_default_scenario):
    """Backward-compatible tuple для точечных truth-table тестов."""
    return (
        fresh_default_scenario.world,
        fresh_default_scenario.full_frame,
        fresh_default_scenario.delta_frame,
    )


@pytest.fixture(scope="module")
def empty_scenario():
    return build_scenario_frames(SCENARIO_EMPTY)


@pytest.fixture(scope="module", params=scenario_names())
def scenario_frames(request):
    return build_scenario_frames(request.param)


# --- Эталонные проверки: код vs закоммиченный JSON. Ловят ЛЮБОЙ дрейф сериализации. ---


def test_full_frame_matches_committed_golden(scenario_frames):
    prefix = fixture_prefix(scenario_frames.name)
    fresh = _frame_to_norm_dict(scenario_frames.full_frame)
    golden = _load_json(f"{prefix}_full.expected.json")
    _deep_approx_equal(fresh, golden)


def test_delta_frame_matches_committed_golden(scenario_frames):
    prefix = fixture_prefix(scenario_frames.name)
    fresh = _frame_to_norm_dict(scenario_frames.delta_frame)
    golden = _load_json(f"{prefix}_delta.expected.json")
    _deep_approx_equal(fresh, golden)


# --- Детерминизм содержимого: несжатый protobuf кода должен совпадать с .bin. ---
# Zlib-байты сравнивать нельзя: их вывод зависит от платформы/версии zlib.
# Поэтому .bin распаковывается и парсится, а затем обе стороны сериализуются
# заново с deterministic=True — порядок map-полей в самом .bin не важен.


def test_full_frame_bytes_match_committed(scenario_frames):
    prefix = fixture_prefix(scenario_frames.name)
    _assert_protobuf_matches_committed(scenario_frames.full_frame, f"{prefix}_full.bin")


def test_delta_frame_bytes_match_committed(scenario_frames):
    prefix = fixture_prefix(scenario_frames.name)
    _assert_protobuf_matches_committed(scenario_frames.delta_frame, f"{prefix}_delta.bin")


# --- Round-trip sanity: .bin (сжатый транспортный fixture) декодируется protobuf-ом. ---


def test_committed_frames_decode(scenario_frames):
    prefix = fixture_prefix(scenario_frames.name)
    full = _load_committed_frame(f"{prefix}_full.bin")
    delta = _load_committed_frame(f"{prefix}_delta.bin")
    assert full.type == snake_pb2.GameStateFrame.FrameType.FULL
    assert delta.type == snake_pb2.GameStateFrame.FrameType.DELTA
    assert full.frame_seq == AOI_TICKS
    assert delta.frame_seq == AOI_TICKS + DELTA_TICKS


# --- Body/new_heads truth table (M3-03). ---


def _player_message(player, *, in_aoi: bool, is_full: bool = False) -> "snake_pb2.Player":
    msg = snake_pb2.Player()
    populate_player_message(msg, player, in_aoi=in_aoi, is_full=is_full)
    return msg


def test_full_frame_body_truth_table(fresh_default_scenario):
    world = fresh_default_scenario.world
    full_frame = fresh_default_scenario.full_frame

    aoi = full_frame.players[CLIENT_ID]
    assert not aoi.HasField("body_truncated")
    assert aoi.length == len(aoi.body) // 2 == world.players[CLIENT_ID].body_len
    assert len(aoi.body) > 2

    for pid in (CLIENT_ID, "player_edge", "player_teleport", "player_dies"):
        msg = full_frame.players[pid]
        assert not msg.HasField("body_truncated"), pid
        assert list(msg.body) == pytest.approx(list(fresh_default_scenario.full_bodies[pid])), pid
        assert list(msg.body[:2]) == pytest.approx(
            list(fresh_default_scenario.full_bodies[pid][:2])
        ), pid
        assert msg.length == len(fresh_default_scenario.full_bodies[pid]) // 2, pid

    for pid in ("player_far", "player_new", "player_enter"):
        msg = full_frame.players[pid]
        assert msg.HasField("body_truncated"), pid
        assert msg.body_truncated is True, pid
        assert msg.length == 1, pid
        assert list(msg.body) == pytest.approx(list(fresh_default_scenario.full_bodies[pid][:2])), (
            pid
        )

    dead = full_frame.players["player_dead"]
    assert dead.is_dead is True
    assert not dead.body
    assert not dead.new_heads
    assert dead.length == 0
    assert dead.HasField("final_length")
    assert dead.final_length == world.players["player_dead"].final_length > 0
    assert not dead.HasField("body_truncated")


def test_delta_frame_body_truth_table(fresh_world_frames):
    world, _, delta_frame = fresh_world_frames
    assert set(delta_frame.players) == set(world.players)

    aoi = delta_frame.players[CLIENT_ID]
    aoi_player = world.players[CLIENT_ID]
    assert list(aoi.new_heads) == pytest.approx(aoi_player.new_heads_this_tick)
    assert not aoi.body
    assert aoi.length == aoi_player.body_len
    assert not aoi.HasField("body_truncated")

    # Every alive player's authoritative head is first in body or new_heads.
    for pid, player in world.players.items():
        msg = delta_frame.players[pid]
        if player.is_dead:
            assert not msg.body, pid
            assert not msg.new_heads, pid
            assert msg.length == 0, pid
            assert msg.HasField("final_length"), pid
            assert msg.final_length == player.final_length > 0, pid
            assert not msg.HasField("body_truncated"), pid
            continue

        head = list(msg.new_heads[:2]) or list(msg.body[:2])
        assert head == pytest.approx([player.body[0], player.body[1]]), pid
        if msg.body_truncated:
            assert msg.length == 1, pid
        else:
            assert msg.length == player.body_len, pid
        assert not msg.HasField("final_length"), pid

    # Just-respawned player outside AoI uses the body branch, not new_heads.
    new = delta_frame.players["player_new"]
    new_player = world.players["player_new"]
    assert not new.new_heads
    assert list(new.body) == pytest.approx([new_player.body[0], new_player.body[1]])
    assert new.body_truncated is True
    assert new.length == 1


def test_in_aoi_full_and_delta_keep_full_body_and_length():
    world = build_deterministic_world()
    player = world.players[CLIENT_ID]
    flat_body = list(player.body)

    full = _player_message(player, in_aoi=True, is_full=True)
    assert list(full.body) == flat_body
    assert list(full.body[:2]) == pytest.approx([player.head_x, player.head_y])
    assert full.length == player.body_len
    assert not full.HasField("body_truncated")

    player.just_respawned = False
    player.new_heads_this_tick = [player.head_x + 0.1, player.head_y]
    delta = _player_message(player, in_aoi=True, is_full=False)
    assert list(delta.new_heads) == pytest.approx([player.head_x + 0.1, player.head_y])
    assert not delta.body
    assert delta.length == player.body_len
    assert not delta.HasField("body_truncated")


def test_out_of_aoi_full_sends_first_point_with_truncation_flag():
    world = build_deterministic_world()
    player = world.players["player_far"]

    msg = _player_message(player, in_aoi=False, is_full=True)
    assert list(msg.body) == [player.body[0], player.body[1]]
    assert not msg.new_heads
    assert msg.length == 1
    assert msg.HasField("body_truncated")
    assert msg.body_truncated is True


def test_out_of_aoi_delta_sends_first_new_head_with_truncation_flag():
    world = build_deterministic_world()
    player = world.players["player_far"]
    player.just_respawned = False
    player.new_heads_this_tick = [5.6, 5.0]

    msg = _player_message(player, in_aoi=False, is_full=False)
    assert list(msg.new_heads) == pytest.approx([5.6, 5.0])
    assert not msg.body
    assert msg.length == 1
    assert msg.HasField("body_truncated")
    assert msg.body_truncated is True


def test_just_respawned_out_of_aoi_uses_body_branch_with_flag():
    world = build_deterministic_world()
    player = world.players["player_far"]
    assert player.just_respawned

    msg = _player_message(player, in_aoi=False, is_full=False)
    assert list(msg.body) == [player.body[0], player.body[1]]
    assert not msg.new_heads
    assert msg.length == 1
    assert msg.body_truncated is True


def test_out_of_aoi_without_points_still_marks_truncated():
    world = build_deterministic_world()
    player = world.players["player_far"]
    player.just_respawned = False
    player.body.clear()
    player.new_heads_this_tick = []

    full = _player_message(player, in_aoi=False, is_full=True)
    assert not full.body
    assert full.length == 1
    assert full.body_truncated is True

    delta = _player_message(player, in_aoi=False, is_full=False)
    assert not delta.body
    assert not delta.new_heads
    assert delta.length == 1
    assert delta.body_truncated is True


def test_real_one_segment_in_aoi_is_not_marked_truncated():
    """length=1 without body_truncated is a real one-segment snake, not a mini point."""
    world = build_deterministic_world()
    player = world.players[CLIENT_ID]
    player.body.clear()
    player.body.extend((50.0, 50.0))
    player.just_respawned = False
    player.new_heads_this_tick = [50.1, 50.0]

    full = _player_message(player, in_aoi=True, is_full=True)
    assert list(full.body) == pytest.approx([50.0, 50.0])
    assert full.length == 1
    assert not full.HasField("body_truncated")

    delta = _player_message(player, in_aoi=True, is_full=False)
    assert list(delta.new_heads) == pytest.approx([50.1, 50.0])
    assert not delta.body
    assert delta.length == 1
    assert not delta.HasField("body_truncated")


@pytest.mark.parametrize(
    ("in_aoi", "is_full"),
    [(True, False), (False, False), (True, True), (False, True)],
)
def test_dead_player_has_empty_body_and_zero_length(in_aoi, is_full):
    world = build_deterministic_world()
    player = world.players[CLIENT_ID]
    expected_final = player.body_len
    assert expected_final > 0
    player.final_length = expected_final
    player.is_dead = True
    player.body.clear()
    player.new_heads_this_tick = []

    msg = _player_message(player, in_aoi=in_aoi, is_full=is_full)
    assert not msg.body
    assert not msg.new_heads
    assert msg.length == 0
    assert msg.HasField("final_length")
    assert msg.final_length == expected_final
    assert not msg.HasField("body_truncated")


@pytest.mark.parametrize(
    ("in_aoi", "is_full"),
    [(True, False), (False, False), (True, True), (False, True)],
)
def test_alive_player_does_not_emit_final_length(in_aoi, is_full):
    world = build_deterministic_world()
    player = world.players[CLIENT_ID]
    # A stale final_length from a previous life must never leak while alive.
    player.final_length = 99

    msg = _player_message(player, in_aoi=in_aoi, is_full=is_full)
    assert not msg.HasField("final_length")


# --- Golden-специфичные переходы: death, teleport, AoI transition, seam, empty. ---


def test_delta_death_clears_body_and_preserves_final_length(fresh_default_scenario):
    world = fresh_default_scenario.world
    delta = fresh_default_scenario.delta_frame

    dead = delta.players["player_dies"]
    player = world.players["player_dies"]
    assert "player_dies" in fresh_default_scenario.full_visible
    assert "player_dies" not in fresh_default_scenario.delta_visible
    assert dead.is_dead is True
    assert dead.length == 0
    assert not dead.body
    assert not dead.new_heads
    assert dead.final_length == player.final_length > 0
    assert dead.deaths == 1


def test_full_teleport_fields_and_body(fresh_default_scenario):
    world = fresh_default_scenario.world
    full = fresh_default_scenario.full_frame
    msg = full.players["player_teleport"]
    full_body = fresh_default_scenario.full_bodies["player_teleport"]

    assert msg.teleport_state == "in_transit"
    assert msg.teleport_out_x == pytest.approx(70.0)
    assert msg.teleport_out_y == pytest.approx(70.0)
    assert msg.teleport_timer_ratio == pytest.approx(0.5)
    assert list(msg.body) == pytest.approx(list(full_body))
    assert msg.length == len(full_body) // 2
    assert not msg.HasField("body_truncated")
    # The FULL tick still shows the in-AoI body, not yet the exit point.
    assert list(msg.body[:2]) == pytest.approx(list(full_body[:2]))
    assert world.players["player_teleport"].teleport_out_pos == pytest.approx((70.0, 70.0))


def test_delta_teleport_continues_to_exit_point(fresh_default_scenario):
    world = fresh_default_scenario.world
    delta = fresh_default_scenario.delta_frame
    player = world.players["player_teleport"]
    msg = delta.players["player_teleport"]

    assert msg.teleport_state == "in_transit"
    assert msg.teleport_out_x == pytest.approx(70.0)
    assert msg.teleport_out_y == pytest.approx(70.0)
    expected_ratio = max(0.0, player.teleport_timer) / max(0.001, player.teleport_delay)
    assert msg.teleport_timer_ratio == pytest.approx(expected_ratio, abs=0.01)
    # In-transit collapses the body to the exit point; the wire stays mini.
    assert list(msg.new_heads) == pytest.approx([70.0, 70.0])
    assert not msg.body
    assert msg.body_truncated is True
    assert msg.length == 1


def test_aoi_transition_on_delta_sends_full_body(fresh_default_scenario):
    world = fresh_default_scenario.world
    delta = fresh_default_scenario.delta_frame
    player = world.players["player_enter"]
    msg = delta.players["player_enter"]

    assert "player_enter" not in fresh_default_scenario.full_visible
    assert "player_enter" in fresh_default_scenario.delta_visible
    assert not msg.HasField("body_truncated")
    assert list(msg.body) == pytest.approx(list(player.body))
    assert msg.length == player.body_len
    assert list(msg.body[:2]) == pytest.approx([player.head_x, player.head_y])


def test_edge_spawn_body_is_head_first_and_wrapped_through_seam(fresh_default_scenario):
    world = fresh_default_scenario.world
    msg = fresh_default_scenario.full_frame.players["player_edge"]
    full_body = fresh_default_scenario.full_bodies["player_edge"]

    xs = list(msg.body[0::2])
    ys = list(msg.body[1::2])
    assert len(msg.body) == len(full_body)
    assert msg.length == len(full_body) // 2
    assert list(msg.body) == pytest.approx(list(full_body))
    # Head-first: body[0:2] is the live head from the FULL tick.
    assert list(msg.body[:2]) == pytest.approx(list(full_body[:2]))
    assert xs[0] == pytest.approx(full_body[0])
    assert all(0 <= x < world.grid_width for x in xs)
    assert all(0 <= y < world.grid_height for y in ys)
    assert any(x >= world.grid_width - 1 for x in xs)


def test_empty_scenario_has_no_players_and_deterministic_seq(empty_scenario):
    full = empty_scenario.full_frame
    delta = empty_scenario.delta_frame

    assert empty_scenario.full_visible == frozenset()
    assert empty_scenario.delta_visible == frozenset()
    assert not full.players
    assert not delta.players
    assert full.type == snake_pb2.GameStateFrame.FrameType.FULL
    assert delta.type == snake_pb2.GameStateFrame.FrameType.DELTA
    assert full.frame_seq == full.server_tick == AOI_TICKS
    assert delta.frame_seq == delta.server_tick == AOI_TICKS + DELTA_TICKS
    # An empty world still carries the shared world/food payload on FULL.
    assert full.foods


# --- frame_seq / server_tick (M3-05). ---


def test_full_and_delta_carry_frame_sequence(fresh_default_scenario):
    full_frame = fresh_default_scenario.full_frame
    delta_frame = fresh_default_scenario.delta_frame

    for frame in (full_frame, delta_frame):
        assert frame.HasField("frame_seq")
        assert frame.HasField("server_tick")
        assert frame.frame_seq == frame.server_tick
        # The fields are distinct from server_tick_rate (field 2).
        assert frame.frame_seq != frame.server_tick_rate

    # Each tick advances the sequence once, across the FULL -> DELTA boundary.
    assert full_frame.frame_seq == AOI_TICKS
    assert delta_frame.frame_seq == AOI_TICKS + DELTA_TICKS


def test_all_clients_in_one_tick_share_frame_sequence():
    world = build_deterministic_world()
    world.tick()
    tick_seq = world.frame_seq

    full_a = world.get_full_state(CLIENT_ID)
    full_b = world.get_full_state("player_far", serialize_proto=True)
    delta = world.get_delta_state("player_new", is_full=False)

    assert tick_seq > 0
    assert full_a.frame_seq == tick_seq
    assert full_a.server_tick == tick_seq
    decoded_b = snake_pb2.GameStateFrame()
    decoded_b.ParseFromString(full_b)
    assert decoded_b.frame_seq == tick_seq
    assert delta.frame_seq == tick_seq


@pytest.mark.asyncio
async def test_initial_and_resync_full_frames_are_equivalent():
    """The handshake FULL and the resync FULL share one writer (M3-10)."""
    world = build_deterministic_world()
    world.tick()

    initial = world.get_full_state(CLIENT_ID, serialize_proto=False)
    connection = {"queue": asyncio.Queue(maxsize=1), "needs_full_sync": True}
    await server.process_client(CLIENT_ID, connection, world)

    compressed, _visible_players, is_full = connection["queue"].get_nowait()
    resync = snake_pb2.GameStateFrame()
    resync.ParseFromString(zlib.decompress(compressed))

    assert is_full is True
    assert resync.type == snake_pb2.GameStateFrame.FrameType.FULL
    assert _canonical_proto_bytes(initial) == _canonical_proto_bytes(resync)
    assert _frame_to_norm_dict(initial) == _frame_to_norm_dict(resync)
    assert resync.your_id == CLIENT_ID
    assert len(resync.foods) == len(world.food_manager.foods) > 0
    assert set(resync.players) == set(world.players)
    assert resync.frame_seq == initial.frame_seq == world.frame_seq
    assert resync.server_tick == initial.server_tick == world.server_tick


def test_serializing_a_client_does_not_advance_frame_sequence():
    world = build_deterministic_world()
    world.tick()
    after_tick = world.frame_seq

    for client_id in (CLIENT_ID, "player_far", "player_new"):
        world.get_delta_state(client_id, is_full=True)
        world.get_delta_state(client_id, is_full=False)

    # The counter belongs to the tick, not to the number of connected clients.
    assert world.frame_seq == after_tick
    assert world.server_tick == after_tick


def test_frame_sequence_advances_exactly_once_per_tick():
    world = build_deterministic_world()
    start = world.frame_seq

    world.tick()
    assert world.frame_seq == start + 1
    assert world.server_tick == world.frame_seq

    world.get_delta_state(CLIENT_ID)
    world.get_full_state(CLIENT_ID)
    assert world.frame_seq == start + 1

    world.tick()
    assert world.frame_seq == start + 2


def test_reset_state_zeroes_frame_sequence():
    world = build_deterministic_world()
    world.tick()
    world.tick()
    assert world.frame_seq == 2

    world.reset_state()

    assert world.frame_seq == 0
    assert world.server_tick == 0
    assert world.get_delta_state(CLIENT_ID).frame_seq == 0
    assert world.get_full_state(CLIENT_ID).server_tick == 0
