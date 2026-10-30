# ROLE: Contract tests for the generated admin config PATCH schema and its route. Covers field parity with GameConfig, unknown keys and type errors.
import json
import math
import typing
from dataclasses import fields, is_dataclass

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import server
from app.api.admin import _admin_sessions, _login_attempts
from app.api.config_schema import AdminConfigPatch
from game_config import GameConfig


def _assert_model_matches(dataclass_type, model):
    hints = typing.get_type_hints(dataclass_type)
    assert list(model.model_fields) == [item.name for item in fields(dataclass_type)]
    for item in fields(dataclass_type):
        dataclass_annotation = hints[item.name]
        model_annotation = model.model_fields[item.name].annotation
        if is_dataclass(dataclass_annotation):
            _assert_model_matches(dataclass_annotation, model_annotation)
        elif typing.get_origin(dataclass_annotation) is list:
            args = typing.get_args(dataclass_annotation)
            if args and is_dataclass(args[0]):
                item_model = typing.get_args(model_annotation)[0]
                _assert_model_matches(args[0], item_model)


def test_patch_schema_mirrors_every_config_field():
    _assert_model_matches(GameConfig, AdminConfigPatch)


def test_patch_schema_accepts_the_current_config():
    payload = GameConfig().to_dict()

    parsed = AdminConfigPatch.model_validate(payload)

    assert parsed.model_dump(exclude_unset=True) == payload


@pytest.mark.parametrize(
    "payload",
    [
        {"unknown_section": {"value": 1}},
        {"world": {"unknown_key": 1}},
        {"food": {"types": [{"value": 1, "unknown_key": 2}]}},
    ],
)
def test_patch_schema_rejects_unknown_keys(payload):
    with pytest.raises(ValidationError) as exc_info:
        AdminConfigPatch.model_validate(payload)

    assert exc_info.value.errors()[0]["type"] == "extra_forbidden"


def test_patch_schema_rejects_fractional_int():
    with pytest.raises(ValidationError) as exc_info:
        AdminConfigPatch.model_validate({"world": {"width": 100.5}})

    error = exc_info.value.errors()[0]
    assert error["loc"] == ("world", "width")
    assert error["type"] == "int_from_float"


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_patch_schema_rejects_non_finite_floats(value):
    with pytest.raises(ValidationError) as exc_info:
        AdminConfigPatch.model_validate({"world": {"portals_radius": value}})

    error = exc_info.value.errors()[0]
    assert error["loc"] == ("world", "portals_radius")
    assert error["type"] == "finite_number"


def test_patch_schema_rejects_explicit_nulls():
    for payload in (
        {"food": {"types": None}},
        {"world": None},
        {"world": {"width": None}},
    ):
        with pytest.raises(ValidationError):
            AdminConfigPatch.model_validate(payload)


def test_patch_schema_dumps_only_provided_fields():
    parsed = AdminConfigPatch.model_validate(
        {"world": {"width": 200}, "food": {"types": [{"value": 3}]}}
    )

    assert parsed.model_dump(exclude_unset=True) == {
        "world": {"width": 200},
        "food": {"types": [{"value": 3}]},
    }


def test_patch_schema_coerces_numeric_formula_to_string():
    parsed = AdminConfigPatch.model_validate({"snake": {"growth_score_per_segment": 10}})

    assert parsed.model_dump(exclude_unset=True) == {"snake": {"growth_score_per_segment": "10"}}


@pytest.fixture
def admin_client(tmp_path, monkeypatch):
    _admin_sessions.clear()
    _login_attempts.clear()
    monkeypatch.setenv("ADMIN_PASSWORD", "schema-test")
    monkeypatch.setenv("CONFIG_PATH", str(tmp_path / "config.json"))

    with TestClient(server.app) as client:
        response = client.post("/admin/login", json={"password": "schema-test"})
        assert response.status_code == 200
        yield client

    _admin_sessions.clear()
    _login_attempts.clear()


def test_admin_config_route_rejects_unknown_key(admin_client):
    response = admin_client.patch("/admin/config", json={"world": {"target_food_cout": 100}})

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "world", "target_food_cout"]


def test_admin_config_route_rejects_fractional_width(admin_client):
    response = admin_client.patch("/admin/config", json={"world": {"width": 100.5}})

    assert response.status_code == 422


@pytest.mark.parametrize("literal", ["NaN", "Infinity", "-Infinity"])
def test_admin_config_route_rejects_non_finite_floats(admin_client, tmp_path, literal):
    config_path = tmp_path / "config.json"
    before = config_path.read_text(encoding="utf-8")

    response = admin_client.patch(
        "/admin/config",
        content=f'{{"world": {{"portals_radius": {literal}}}}}',
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422
    assert config_path.read_text(encoding="utf-8") == before


def test_admin_config_route_keeps_range_errors_as_400(admin_client):
    response = admin_client.patch("/admin/config", json={"world": {"width": 5}})

    assert response.status_code == 400
    assert "world.width" in response.json()["detail"]


def test_admin_config_route_persists_valid_partial_patch(admin_client, tmp_path):
    response = admin_client.patch("/admin/config", json={"world": {"target_food_count": 123}})

    assert response.status_code == 200
    assert response.json()["world"]["target_food_count"] == 123
    saved = json.loads((tmp_path / "config.json").read_text(encoding="utf-8"))
    assert saved["world"]["target_food_count"] == 123
