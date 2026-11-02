# ROLE: Parity-тест тороидальной математики. Сверяет Python-реализацию с golden vectors из tests_shared/,
# включая wrap_delta/wrap_coordinate и tie-case на ровно половине периода.
import json
import math
import os
import pytest

from app.engine.systems.math_utils import (
    toroidal_delta,
    toroidal_distance,
    wrap_coordinate,
    wrap_delta,
)

VECTORS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "tests_shared", "golden_vectors", "math.json"
)

ABS_TOL = 1e-6
REL_TOL = 1e-9


def _load_vectors():
    with open(VECTORS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def vectors():
    return _load_vectors()


def test_toroidal_delta_parity(vectors):
    for i, v in enumerate(vectors):
        dx, dy = toroidal_delta(v["x1"], v["y1"], v["x2"], v["y2"], v["width"], v["height"])
        exp_dx, exp_dy = v["expected_delta"]
        assert math.isclose(dx, exp_dx, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): delta_x mismatch: got {dx}, expected {exp_dx}"
        )
        assert math.isclose(dy, exp_dy, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): delta_y mismatch: got {dy}, expected {exp_dy}"
        )


def test_toroidal_distance_parity(vectors):
    for i, v in enumerate(vectors):
        dist = toroidal_distance(v["x1"], v["y1"], v["x2"], v["y2"], v["width"], v["height"])
        exp_dist = v["expected_distance"]
        assert math.isclose(dist, exp_dist, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): distance mismatch: got {dist}, expected {exp_dist}"
        )


def test_wrap_delta_parity(vectors):
    for i, v in enumerate(vectors):
        if "expected_wrap_delta" not in v:
            continue
        exp_dx, exp_dy = v["expected_wrap_delta"]
        dx = wrap_delta(v["x2"] - v["x1"], v["width"])
        dy = wrap_delta(v["y2"] - v["y1"], v["height"])
        assert math.isclose(dx, exp_dx, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): wrap_delta_x mismatch: got {dx}, expected {exp_dx}"
        )
        assert math.isclose(dy, exp_dy, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): wrap_delta_y mismatch: got {dy}, expected {exp_dy}"
        )


def test_wrap_coordinate_parity(vectors):
    for i, v in enumerate(vectors):
        if "expected_wrap_nearest" not in v:
            continue
        exp_x, exp_y = v["expected_wrap_nearest"]
        wx = wrap_coordinate(v["x2"], v["width"])
        wy = wrap_coordinate(v["y2"], v["height"])
        assert math.isclose(wx, exp_x, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): wrap_x mismatch: got {wx}, expected {exp_x}"
        )
        assert math.isclose(wy, exp_y, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): wrap_y mismatch: got {wy}, expected {exp_y}"
        )


def test_wrap_delta_tie_keeps_sign():
    assert wrap_delta(500.0, 1000.0) == 500.0
    assert wrap_delta(-500.0, 1000.0) == -500.0
    assert toroidal_delta(0, 0, 500, 0, 1000, 1000)[0] == 500.0
    assert toroidal_delta(500, 0, 0, 0, 1000, 1000)[0] == -500.0


def test_wrap_delta_handles_multiple_periods():
    assert wrap_delta(2500.0, 1000.0) == 500.0
    assert wrap_delta(-2500.0, 1000.0) == -500.0
    assert wrap_delta(2600.0, 1000.0) == -400.0


def test_wrap_guards_invalid_sizes_and_non_finite_values():
    assert wrap_coordinate(5.0, 0.0) == 5.0
    assert wrap_coordinate(5.0, -10.0) == 5.0
    assert wrap_coordinate(5.0, math.inf) == 5.0
    assert math.isnan(wrap_coordinate(math.nan, 1000.0))
    assert wrap_delta(123.0, 0.0) == 123.0
    assert wrap_delta(123.0, -10.0) == 123.0
    assert wrap_delta(math.inf, 1000.0) == math.inf
    assert math.isnan(wrap_delta(math.nan, 1000.0))
