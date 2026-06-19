# ROLE: Генерация эталонных кадров (FULL + DELTA) для parity-тестов. Запуск вручную при изменении формата.

import json
import os
import zlib
from google.protobuf.json_format import MessageToDict

# Add backend to path so imports work
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.frame_scenario import build_full_and_delta_world

OUTPUT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames"
)


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
    _world, full_frame, delta_frame = build_full_and_delta_world()

    # FULL frame: сжатые байты (как отправляется по сети) + эталонный JSON.
    full_compressed = zlib.compress(full_frame.SerializeToString(), 1)
    full_dict = MessageToDict(full_frame, preserving_proto_field_name=True)
    _write_bin(os.path.join(OUTPUT_DIR, "frame_full.bin"), full_compressed)
    _write_json(
        os.path.join(OUTPUT_DIR, "frame_full.expected.json"), _round_floats(full_dict)
    )

    # DELTA frame.
    delta_compressed = zlib.compress(delta_frame.SerializeToString(), 1)
    delta_dict = MessageToDict(delta_frame, preserving_proto_field_name=True)
    _write_bin(os.path.join(OUTPUT_DIR, "frame_delta.bin"), delta_compressed)
    _write_json(
        os.path.join(OUTPUT_DIR, "frame_delta.expected.json"),
        _round_floats(delta_dict),
    )

    print(f"[fixtures] Written to {os.path.abspath(OUTPUT_DIR)}")


def _write_bin(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _write_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    _generate_and_save()
