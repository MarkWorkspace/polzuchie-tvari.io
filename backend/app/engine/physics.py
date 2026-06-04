import math

def toroidal_delta(x1, y1, x2, y2, grid_width, grid_height):
    """
    Returns (dx, dy) representing the shortest vector from (x1, y1) to (x2, y2)
    considering toroidal wrapping (map edges wrap around).
    """
    dx = x2 - x1
    if dx > grid_width / 2:
        dx -= grid_width
    elif dx < -grid_width / 2:
        dx += grid_width

    dy = y2 - y1
    if dy > grid_height / 2:
        dy -= grid_height
    elif dy < -grid_height / 2:
        dy += grid_height

    return dx, dy

def toroidal_distance(x1, y1, x2, y2, grid_width, grid_height):
    """
    Calculates the shortest Euclidean distance between (x1, y1) and (x2, y2)
    under toroidal wrap boundary conditions.
    """
    dx, dy = toroidal_delta(x1, y1, x2, y2, grid_width, grid_height)
    return math.hypot(dx, dy)
