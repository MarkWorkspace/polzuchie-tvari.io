# ROLE: Config validation tests: finite floats, strict ints, ranges and fail-fast startup on invalid config.json.
import json
import logging
import math

import pytest

from app.engine.state import World
from game_config import GameConfig


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_apply_patch_rejects_non_finite_float(value):
    config = GameConfig()

    with pytest.raises(ValueError, match="must be finite"):
        config.apply_patch({"world": {"portals_radius": value}})


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_validate_rejects_non_finite_float_mutation(value):
    config = GameConfig()
    config.world.portals_radius = value

    with pytest.raises(ValueError, match="world.portals_radius must be finite"):
        config.validate()


@pytest.mark.parametrize("value", [100.0, True, "100"])
def test_apply_patch_rejects_non_int_for_int_field(value):
    config = GameConfig()

    with pytest.raises(ValueError, match="world.width must be an integer"):
        config.apply_patch({"world": {"width": value}})


def test_validate_rejects_fractional_int_mutation():
    config = GameConfig()
    config.world.width = 100.5

    with pytest.raises(ValueError, match="world.width must be an integer"):
        config.validate()


def test_apply_patch_recurses_into_dataclass_list():
    config = GameConfig()

    with pytest.raises(ValueError, match=r"food\.types\[0\]\.value must be an integer"):
        config.apply_patch({"food": {"types": [{"value": 1.0}]}})


def test_float_field_accepts_int_value():
    config = GameConfig()

    config.apply_patch({"world": {"portals_radius": 3}})

    assert config.world.portals_radius == 3


@pytest.mark.parametrize("value", [0, 101])
def test_max_steps_per_tick_rejects_out_of_range(value):
    config = GameConfig()

    with pytest.raises(
        ValueError,
        match="simulation.max_steps_per_tick must be between 1 and 100",
    ):
        config.apply_patch({"simulation": {"max_steps_per_tick": value}})


@pytest.mark.parametrize("value", [1, 100])
def test_max_steps_per_tick_accepts_valid_bounds(value):
    config = GameConfig()

    config.apply_patch({"simulation": {"max_steps_per_tick": value}})

    assert config.simulation.max_steps_per_tick == value


@pytest.mark.parametrize("value", [-1, 60001])
def test_portals_teleport_delay_rejects_out_of_range(value):
    config = GameConfig()

    with pytest.raises(
        ValueError,
        match="world.portals_teleport_delay_ms must be between 0 and 60000",
    ):
        config.apply_patch({"world": {"portals_teleport_delay_ms": value}})


@pytest.mark.parametrize("value", [0, 60000])
def test_portals_teleport_delay_accepts_valid_bounds(value):
    config = GameConfig()

    config.apply_patch({"world": {"portals_teleport_delay_ms": value}})

    assert config.world.portals_teleport_delay_ms == value


@pytest.mark.parametrize(
    "patch",
    [
        {"world": {"portals_radius": math.nan}},
        {"world": {"width": 100.5}},
        {"world": {"portals_teleport_delay_ms": -1}},
        {"simulation": {"max_steps_per_tick": 0}},
    ],
)
def test_world_rejects_invalid_config_file(tmp_path, monkeypatch, caplog, patch):
    config_path = tmp_path / "invalid.json"
    config_path.write_text(json.dumps(patch), encoding="utf-8")
    monkeypatch.setenv("CONFIG_PATH", str(config_path))

    with caplog.at_level(logging.ERROR, logger="app.engine.state"):
        with pytest.raises(RuntimeError, match="Invalid config file"):
            World()

    assert any("Failed to load config" in record.getMessage() for record in caplog.records)


def test_world_loads_valid_config_file(tmp_path, monkeypatch):
    config_path = tmp_path / "valid.json"
    config_path.write_text(
        json.dumps(
            {
                "simulation": {"max_steps_per_tick": 7},
                "world": {"portals_teleport_delay_ms": 2500},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("CONFIG_PATH", str(config_path))

    world = World()

    assert world.config.simulation.max_steps_per_tick == 7
    assert world.config.world.portals_teleport_delay_ms == 2500


def test_world_uses_defaults_when_config_file_is_missing(tmp_path, monkeypatch):
    config_path = tmp_path / "missing.json"
    monkeypatch.setenv("CONFIG_PATH", str(config_path))

    world = World()

    assert world.config.simulation.max_steps_per_tick == 4
    assert world.config.world.portals_teleport_delay_ms == 1500
    assert not config_path.exists()


def test_save_rejects_nan_without_writing_file(tmp_path):
    world = World()
    target_path = tmp_path / "nan.json"
    world.config_file_path = str(target_path)
    world.config.world.portals_radius = math.nan

    with pytest.raises(ValueError):
        world._save_config_to_disk()

    assert not target_path.exists()
    assert not list(tmp_path.glob(".nan.json.*.tmp"))
