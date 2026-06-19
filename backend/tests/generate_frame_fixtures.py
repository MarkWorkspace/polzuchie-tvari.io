# ROLE: Генерация эталонных кадров (FULL + DELTA) для parity-тестов. Запуск вручную при изменении формата.

import json
import os
import random
import sys
import zlib
from google.protobuf.json_format import MessageToDict

# Add backend to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engine.state import World
from app.engine.systems.serialization import get_full_state, get_delta_state

OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames"
)


def _build_deterministic_world() -> World:
    """Create a small deterministic world with known players and food."""
    random.seed(42)
    world = World()

    # Add 3 players at known positions
    world.add_player("player_aoi", nickname="InAoI", skin="#ff0000")
    world.add_player("player_far", nickname="FarAway", skin="#00ff00")
    world.add_player("player_new", nickname="JustSpawned", skin="#0000ff")

    p1 = world.players["player_aoi"]
    p2 = world.players["player_far"]
    p3 = world.players["player_new"]

    _set_player_pos(p1, 50.0, 50.0)
    _set_player_pos(p2, 5.0, 5.0)  # Near p1 in AoI
    _set_player_pos(p3, 90.0, 90.0)  # Far from p1

    return world


def _set_player_pos(player, x: float, y: float) -> None:
    """Override player body to start at (x, y)."""
    player.body.clear()
    start_len = player.config.snake.start_length
    for i in range(start_len):
        player.body.append(x - i)
        player.body.append(y)
    player.angle = 0.0


def _do_ticks(world: World, count: int) -> None:
    """Run N ticks to get non-trivial delta state."""
    for _ in range(count):
        world.tick()


def _round_floats(val):
    if isinstance(val, float):
        return round(val, 2)
    if isinstance(val, dict):
        return {k: _round_floats(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_round_floats(v) for v in val]
    return val


def _generate_and_save() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    world = _build_deterministic_world()
    _do_ticks(world, 2)

    # -- FULL frame --
    full_frame = get_full_state(world, "player_aoi", serialize_proto=False)
    full_packed = full_frame.SerializeToString()
    full_compressed = zlib.compress(full_packed, 1)
    full_dict = MessageToDict(full_frame, preserving_proto_field_name=True)

    _write_bin(os.path.join(OUTPUT_DIR, "frame_full.bin"), full_compressed)
    _write_json(
        os.path.join(OUTPUT_DIR, "frame_full.expected.json"),
        _round_floats(full_dict),
    )

    # -- DELTA frame --
    world.client_visibility["player_aoi"] = set(world.players.keys())
    _do_ticks(world, 1)
    delta_frame = get_delta_state(world, "player_aoi", is_full=False, serialize_proto=False)
    delta_packed = delta_frame.SerializeToString()
    delta_compressed = zlib.compress(delta_packed, 1)
    delta_dict = MessageToDict(delta_frame, preserving_proto_field_name=True)

    _write_bin(os.path.join(OUTPUT_DIR, "frame_delta.bin"), delta_compressed)
    _write_json(
        os.path.join(OUTPUT_DIR, "frame_delta.expected.json"),
        _round_floats(delta_dict),
    )


def _write_bin(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    _generate_and_save()
