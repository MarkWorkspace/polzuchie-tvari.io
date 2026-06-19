# ROLE: Round-trip parity-тест сетевого кадра. Кодирует → декодирует → сравнивает с .expected.json.
import json
import math
import os
import zlib
import pytest
from google.protobuf.json_format import MessageToDict

# Add backend to path so imports work
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engine.systems import snake_pb2

FIXTURES_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames"
)


def _load_bin(name: str) -> bytes:
    with open(os.path.join(FIXTURES_DIR, name), "rb") as f:
        return f.read()


def _load_json(name: str) -> dict:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8") as f:
        return json.load(f)


def _round_trip(compressed: bytes) -> dict:
    """Decompress + Protobuf decode."""
    raw = zlib.decompress(compressed)
    frame = snake_pb2.GameStateFrame()
    frame.ParseFromString(raw)
    return MessageToDict(frame, preserving_proto_field_name=True)


def _normalize(obj):
    """Round floats to 2 decimals, sort dict keys for stable comparison."""
    return json.loads(json.dumps(obj, default=_default, sort_keys=True))


def _default(o):
    if isinstance(o, float):
        return round(o, 2)
    if isinstance(o, bytes):
        return list(o)
    raise TypeError(f"Not serializable: {type(o)}")


def _deep_approx_equal(a, b, path="root", tol=0.01):
    """Recursively compare two structures with float tolerance."""
    if isinstance(a, dict) and isinstance(b, dict):
        assert set(a.keys()) == set(b.keys()), (
            f"Key mismatch at {path}: {set(a.keys()) ^ set(b.keys())}"
        )
        for k in a:
            _deep_approx_equal(a[k], b[k], f"{path}.{k}", tol)
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b), (
            f"Length mismatch at {path}: {len(a)} vs {len(b)}"
        )
        for i in range(len(a)):
            _deep_approx_equal(a[i], b[i], f"{path}[{i}]", tol)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        assert math.isclose(float(a), float(b), abs_tol=tol), (
            f"Numeric mismatch at {path}: {a} vs {b}"
        )
    else:
        assert a == b, f"Value mismatch at {path}: {a!r} vs {b!r}"


def test_full_frame_round_trip():
    compressed = _load_bin("frame_full.bin")
    expected = _load_json("frame_full.expected.json")
    decoded = _round_trip(compressed)
    _deep_approx_equal(_normalize(decoded), expected)


def test_delta_frame_round_trip():
    compressed = _load_bin("frame_delta.bin")
    expected = _load_json("frame_delta.expected.json")
    decoded = _round_trip(compressed)
    _deep_approx_equal(_normalize(decoded), expected)
