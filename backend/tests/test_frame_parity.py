# ROLE: Parity-тест сетевого кадра. Ловит дрейф серверной сериализации:
# пересчитывает кадр из кода (frame_scenario) и сравнивает с ЗАКОММИЧЕННЫМ эталоном .expected.json.
# Также проверяет, что закоммиченный .bin побайтово совпадает с тем, что генерирует текущий код.

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

FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames"
)


def _load_bin(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


def _load_json(name: str) -> dict:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return json.load(f)


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


# --- Детерминизм байтов: .bin должен совпадать с тем, что генерирует код сейчас. ---

def test_full_frame_bytes_match_committed(fresh_world_frames):
    full_frame, _ = fresh_world_frames
    fresh_compressed = zlib.compress(full_frame.SerializeToString(), 1)
    committed = _load_bin("frame_full.bin")
    assert fresh_compressed == committed, (
        "frame_full.bin разошёлся с кодом. Перезапустите generate_frame_fixtures.py "
        "и закоммитьте обновлённые фикстуры (ОСОЗНАННО, проверив diff)."
    )


def test_delta_frame_bytes_match_committed(fresh_world_frames):
    _, delta_frame = fresh_world_frames
    fresh_compressed = zlib.compress(delta_frame.SerializeToString(), 1)
    committed = _load_bin("frame_delta.bin")
    assert fresh_compressed == committed, (
        "frame_delta.bin разошёлся с кодом. Перезапустите generate_frame_fixtures.py "
        "и закоммитьте обновлённые фикстуры (ОСОЗНАННО, проверив diff)."
    )


# --- Round-trip sanity: protobuf декодирует то, что закодировал (базовая целостность). ---

def test_committed_full_frame_decodes():
    raw = zlib.decompress(_load_bin("frame_full.bin"))
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(raw)
    assert frame.type == snake_pb2.GameStateFrame.FrameType.FULL
