# ROLE: Parity-тест сетевого кадра. Ловит дрейф серверной сериализации:
# пересчитывает кадр из кода (frame_scenario) и сравнивает с ЗАКОММИЧЕННЫМ эталоном .expected.json.
# Также сверяет содержимое с закоммиченным .bin по каноническому НЕСЖАТОМУ protobuf.
# .bin — сжатая транспортная фикстура (для decoder round-trip), а не эталон zlib-байтов.

import json
import math
import os
import zlib
import pytest
from google.protobuf.json_format import MessageToDict

import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engine.systems import snake_pb2
from app.engine.systems.serialization import populate_player_message
from tests.frame_scenario import (
    AOI_TICKS,
    DELTA_TICKS,
    build_deterministic_world,
    build_full_and_delta_world,
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
def fresh_world_frames():
    """Пересчитать FULL и DELTA из текущего кода. Не зависит от коммиченных файлов."""
    return build_full_and_delta_world()


# --- Эталонные проверки: код vs закоммиченный JSON. Ловят ЛЮБОЙ дрейф сериализации. ---


def test_full_frame_matches_committed_golden(fresh_world_frames):
    _world, full_frame, _ = fresh_world_frames
    fresh = _frame_to_norm_dict(full_frame)
    golden = _load_json("frame_full.expected.json")
    _deep_approx_equal(fresh, golden)


def test_delta_frame_matches_committed_golden(fresh_world_frames):
    _world, _, delta_frame = fresh_world_frames
    fresh = _frame_to_norm_dict(delta_frame)
    golden = _load_json("frame_delta.expected.json")
    _deep_approx_equal(fresh, golden)


# --- Детерминизм содержимого: несжатый protobuf кода должен совпадать с .bin. ---
# Zlib-байты сравнивать нельзя: их вывод зависит от платформы/версии zlib.
# Поэтому .bin распаковывается и парсится, а затем обе стороны сериализуются
# заново с deterministic=True — порядок map-полей в самом .bin не важен.


def test_full_frame_bytes_match_committed(fresh_world_frames):
    _world, full_frame, _ = fresh_world_frames
    _assert_protobuf_matches_committed(full_frame, "frame_full.bin")


def test_delta_frame_bytes_match_committed(fresh_world_frames):
    _world, _, delta_frame = fresh_world_frames
    _assert_protobuf_matches_committed(delta_frame, "frame_delta.bin")


# --- Round-trip sanity: .bin (сжатый транспортный fixture) декодируется protobuf-ом. ---


def test_committed_full_frame_decodes():
    frame = _load_committed_frame("frame_full.bin")
    assert frame.type == snake_pb2.GameStateFrame.FrameType.FULL


# --- Body/new_heads truth table (M3-03). ---


def _player_message(player, *, in_aoi: bool, is_full: bool = False) -> "snake_pb2.Player":
    msg = snake_pb2.Player()
    populate_player_message(msg, player, in_aoi=in_aoi, is_full=is_full)
    return msg


def test_full_frame_body_truth_table(fresh_world_frames):
    _, full_frame, _ = fresh_world_frames

    aoi = full_frame.players["player_aoi"]
    assert not aoi.HasField("body_truncated")
    assert aoi.length == len(aoi.body) // 2
    assert len(aoi.body) > 2

    for pid in ("player_far", "player_new"):
        far = full_frame.players[pid]
        assert far.HasField("body_truncated")
        assert far.body_truncated is True
        assert far.length == 1
        assert len(far.body) == 2


def test_delta_frame_new_heads_coordinates_and_head_first(fresh_world_frames):
    world, _, delta_frame = fresh_world_frames

    for pid in ("player_aoi", "player_far", "player_new"):
        player = world.players[pid]
        msg = delta_frame.players[pid]
        # new_heads is the authoritative head (x, y) and must match the body head.
        assert list(msg.new_heads[:2]) == pytest.approx([player.body[0], player.body[1]])
        assert msg.length == (player.body_len if pid == "player_aoi" else 1)
        assert msg.body_truncated is (pid != "player_aoi")
        assert msg.HasField("body_truncated") == (pid != "player_aoi")

    aoi = world.players["player_aoi"]
    assert list(delta_frame.players["player_aoi"].new_heads) == pytest.approx(
        aoi.new_heads_this_tick
    )


def test_in_aoi_full_and_delta_keep_full_body_and_length():
    world = build_deterministic_world()
    player = world.players["player_aoi"]
    flat_body = list(player.body)

    full = _player_message(player, in_aoi=True, is_full=True)
    assert list(full.body) == flat_body
    assert list(full.body[:2]) == [player.head_x, player.head_y]
    assert full.length == player.body_len
    assert not full.HasField("body_truncated")

    player.just_respawned = False
    player.new_heads_this_tick = [50.1, 50.0]
    delta = _player_message(player, in_aoi=True, is_full=False)
    assert list(delta.new_heads) == pytest.approx([50.1, 50.0])
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


@pytest.mark.parametrize(
    ("in_aoi", "is_full"),
    [(True, False), (False, False), (True, True), (False, True)],
)
def test_dead_player_has_empty_body_and_zero_length(in_aoi, is_full):
    world = build_deterministic_world()
    player = world.players["player_aoi"]
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
    player = world.players["player_aoi"]
    # A stale final_length from a previous life must never leak while alive.
    player.final_length = 99

    msg = _player_message(player, in_aoi=in_aoi, is_full=is_full)
    assert not msg.HasField("final_length")


# --- frame_seq / server_tick (M3-05). ---


def test_full_and_delta_carry_frame_sequence(fresh_world_frames):
    _world, full_frame, delta_frame = fresh_world_frames

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

    full_a = world.get_full_state("player_aoi")
    full_b = world.get_full_state("player_far", serialize_proto=True)
    delta = world.get_delta_state("player_new", is_full=False)

    assert tick_seq > 0
    assert full_a.frame_seq == tick_seq
    assert full_a.server_tick == tick_seq
    decoded_b = snake_pb2.GameStateFrame()
    decoded_b.ParseFromString(full_b)
    assert decoded_b.frame_seq == tick_seq
    assert delta.frame_seq == tick_seq


def test_serializing_a_client_does_not_advance_frame_sequence():
    world = build_deterministic_world()
    world.tick()
    after_tick = world.frame_seq

    for client_id in ("player_aoi", "player_far", "player_new"):
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

    world.get_delta_state("player_aoi")
    world.get_full_state("player_aoi")
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
    assert world.get_delta_state("player_aoi").frame_seq == 0
    assert world.get_full_state("player_aoi").server_tick == 0
