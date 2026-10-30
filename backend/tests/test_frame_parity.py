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
from tests.frame_scenario import build_full_and_delta_world

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
    _world, full_frame, delta_frame = build_full_and_delta_world()
    return full_frame, delta_frame


# --- Эталонные проверки: код vs закоммиченный JSON. Ловят ЛЮБОЙ дрейф сериализации. ---


def test_full_frame_matches_committed_golden(fresh_world_frames):
    full_frame, _ = fresh_world_frames
    fresh = _frame_to_norm_dict(full_frame)
    golden = _load_json("frame_full.expected.json")
    _deep_approx_equal(fresh, golden)


def test_delta_frame_matches_committed_golden(fresh_world_frames):
    _, delta_frame = fresh_world_frames
    fresh = _frame_to_norm_dict(delta_frame)
    golden = _load_json("frame_delta.expected.json")
    _deep_approx_equal(fresh, golden)


# --- Детерминизм содержимого: несжатый protobuf кода должен совпадать с .bin. ---
# Zlib-байты сравнивать нельзя: их вывод зависит от платформы/версии zlib.
# Поэтому .bin распаковывается и парсится, а затем обе стороны сериализуются
# заново с deterministic=True — порядок map-полей в самом .bin не важен.


def test_full_frame_bytes_match_committed(fresh_world_frames):
    full_frame, _ = fresh_world_frames
    _assert_protobuf_matches_committed(full_frame, "frame_full.bin")


def test_delta_frame_bytes_match_committed(fresh_world_frames):
    _, delta_frame = fresh_world_frames
    _assert_protobuf_matches_committed(delta_frame, "frame_delta.bin")


# --- Round-trip sanity: .bin (сжатый транспортный fixture) декодируется protobuf-ом. ---


def test_committed_full_frame_decodes():
    frame = _load_committed_frame("frame_full.bin")
    assert frame.type == snake_pb2.GameStateFrame.FrameType.FULL
