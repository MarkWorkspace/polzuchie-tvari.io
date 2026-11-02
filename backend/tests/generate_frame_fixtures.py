# ROLE: Генерация эталонных кадров (FULL + DELTA) для всех parity-сценариев.
# Запуск вручную только при осознанном изменении формата/сценария; не runtime-код.

import json
import os
import sys
import zlib

from google.protobuf.json_format import MessageToDict

# Add backend to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.frame_scenario import (  # noqa: E402
    PINNED_CONFIG_PATH,
    build_scenario_frames,
    fixture_prefix,
    scenario_names,
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tests_shared", "golden_frames")


def _round_floats(val):
    if isinstance(val, float):
        return round(val, 2)
    if isinstance(val, dict):
        return {k: _round_floats(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_round_floats(v) for v in val]
    return val


def _write_frame(prefix: str, kind: str, frame) -> None:
    # .bin хранится сжатым как транспортная фикстура для decoder round-trip.
    # Эталоном являются несжатый deterministic protobuf и expected JSON.
    compressed = zlib.compress(frame.SerializeToString(), 1)
    frame_dict = MessageToDict(frame, preserving_proto_field_name=True)
    _write_bin(os.path.join(OUTPUT_DIR, f"{prefix}_{kind}.bin"), compressed)
    _write_json(
        os.path.join(OUTPUT_DIR, f"{prefix}_{kind}.expected.json"),
        _round_floats(frame_dict),
    )
    print(f"[fixtures] {prefix}_{kind}: {len(compressed)} bytes")


def _generate_and_save() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # Golden-кадры должны зависеть только от pinned-конфига, не от runtime config.json.
    os.environ["CONFIG_PATH"] = str(PINNED_CONFIG_PATH)

    for scenario in scenario_names():
        frames = build_scenario_frames(scenario)
        prefix = fixture_prefix(scenario)
        _write_frame(prefix, "full", frames.full_frame)
        _write_frame(prefix, "delta", frames.delta_frame)

    print(f"[fixtures] Written to {os.path.abspath(OUTPUT_DIR)}")


def _write_bin(path: str, data: bytes) -> None:
    with open(path, "wb") as f:
        f.write(data)


def _write_json(path: str, data) -> None:
    # newline="\n" keeps golden JSON byte-identical on Windows and Linux.
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    _generate_and_save()
