# ROLE: toroidal_delta, toroidal_distance, wrap_coordinate, wrap_delta. ЕДИНСТВЕННАЯ копия математики на бэке.

import math


def wrap_coordinate(value: float, size: float) -> float:
    """
    Wraps a coordinate into [0, size).

    Non-finite values and non-positive/non-finite sizes are returned unchanged so
    callers keep their existing fallback behaviour.
    """
    if not math.isfinite(size) or size <= 0 or not math.isfinite(value):
        return value
    return value % size


def wrap_delta(delta: float, size: float) -> float:
    """
    Returns the shortest signed delta on a torus of the given size.

    Exact half-size ties keep the sign of the input (+size/2 stays positive,
    -size/2 stays negative), matching frontend wrapDelta and the golden vectors.
    Invalid sizes return the delta unchanged.
    """
    if not math.isfinite(size) or size <= 0 or not math.isfinite(delta):
        return delta
    reduced = math.fmod(delta, size)
    if reduced > size / 2:
        return reduced - size
    if reduced < -size / 2:
        return reduced + size
    return reduced


def toroidal_delta(
    x1: float, y1: float, x2: float, y2: float, grid_width: float, grid_height: float
) -> tuple[float, float]:
    """
    Returns (dx, dy) representing the shortest vector from (x1, y1) to (x2, y2)
    considering toroidal wrapping (map edges wrap around).
    """
    return wrap_delta(x2 - x1, grid_width), wrap_delta(y2 - y1, grid_height)


def toroidal_distance(
    x1: float, y1: float, x2: float, y2: float, grid_width: float, grid_height: float
) -> float:
    """
    Calculates the shortest Euclidean distance between (x1, y1) and (x2, y2)
    under toroidal wrap boundary conditions.
    """
    dx, dy = toroidal_delta(x1, y1, x2, y2, grid_width, grid_height)
    return math.hypot(dx, dy)
