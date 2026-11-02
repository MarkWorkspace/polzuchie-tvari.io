# ROLE: Guard that the tracked deployment seed config is a complete, valid GameConfig patch.
# Does not test runtime persistence (test_config_persistence.py) or the Docker entrypoint.

import json
from dataclasses import fields
from pathlib import Path

from game_config import GameConfig

BACKEND_DIR = Path(__file__).resolve().parents[1]
EXAMPLE_CONFIG_PATH = BACKEND_DIR / "config.example.json"
SCHEMA_VERSION_PATH = BACKEND_DIR / "config.schema-version"


def _load_example() -> dict:
    patch = json.loads(EXAMPLE_CONFIG_PATH.read_text(encoding="utf-8"))
    assert isinstance(patch, dict)
    return patch


def test_config_example_is_a_valid_full_patch():
    patch = _load_example()
    known_sections = {field.name for field in fields(GameConfig)}
    assert set(patch) <= known_sections
    assert {"world", "simulation", "snake", "boost", "food", "visual"} <= set(patch)

    config = GameConfig()
    config.apply_patch(patch)

    assert config.world.width == patch["world"]["width"]
    assert config.snake.growth_score_per_segment == patch["snake"]["growth_score_per_segment"]


def test_schema_version_is_a_separate_marker():
    assert SCHEMA_VERSION_PATH.read_text(encoding="utf-8").strip().isdigit()
    # GameConfig rewrites the JSON whole, so the version must stay out of it.
    assert "schema_version" not in _load_example()
