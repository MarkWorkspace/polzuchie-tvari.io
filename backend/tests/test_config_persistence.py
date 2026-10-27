# ROLE: Тесты атомарной записи runtime-конфигурации и fallback для bind mount.
import errno
import json
import os

import pytest

from app.engine.state import World


def _world(tmp_path, monkeypatch):
    config_path = tmp_path / "config.json"
    monkeypatch.setenv("CONFIG_PATH", str(config_path))
    world = World()
    return world, config_path


def test_update_config_persists_and_keeps_valid_json(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)

    world.update_config({"world": {"target_food_count": 123}})

    assert world.get_config()["world"]["target_food_count"] == 123
    assert json.loads(config_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 123
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_save_falls_back_to_in_place_write_for_single_file_mount(tmp_path, monkeypatch):
    world, config_path = _world(tmp_path, monkeypatch)

    def fail_replace(source, destination):
        raise OSError(errno.EXDEV, "Invalid cross-device link", source, destination)

    monkeypatch.setattr(os, "replace", fail_replace)
    world.update_config({"world": {"target_food_count": 321}})

    assert json.loads(config_path.read_text(encoding="utf-8"))["world"]["target_food_count"] == 321
    assert not list(tmp_path.glob(".config.json.*.tmp"))


def test_failed_save_does_not_mutate_live_config(tmp_path, monkeypatch):
    world, _ = _world(tmp_path, monkeypatch)
    before = world.get_config()

    def fail_replace(source, destination):
        raise OSError(errno.EACCES, "Permission denied", source, destination)

    monkeypatch.setattr(os, "replace", fail_replace)

    with pytest.raises(OSError):
        world.update_config({"world": {"target_food_count": 777}})

    assert world.get_config() == before
