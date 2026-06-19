# ROLE: Parity-тест тороидальной математики. Сверяет Python-реализацию с golden vectors из tests_shared/.
import json
import math
import os
import pytest

from app.engine.systems.math_utils import toroidal_delta, toroidal_distance

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
        dx, dy = toroidal_delta(
            v["x1"], v["y1"], v["x2"], v["y2"], v["width"], v["height"]
        )
        exp_dx, exp_dy = v["expected_delta"]
        assert math.isclose(dx, exp_dx, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): "
            f"delta_x mismatch: got {dx}, expected {exp_dx}"
        )
        assert math.isclose(dy, exp_dy, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): "
            f"delta_y mismatch: got {dy}, expected {exp_dy}"
        )


def test_toroidal_distance_parity(vectors):
    for i, v in enumerate(vectors):
        dist = toroidal_distance(
            v["x1"], v["y1"], v["x2"], v["y2"], v["width"], v["height"]
        )
        exp_dist = v["expected_distance"]
        assert math.isclose(dist, exp_dist, rel_tol=REL_TOL, abs_tol=ABS_TOL), (
            f"Vector #{i} ({v.get('desc', '')}): "
            f"distance mismatch: got {dist}, expected {exp_dist}"
        )
