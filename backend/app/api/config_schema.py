# ROLE: Admin config PATCH schema derived from the GameConfig dataclasses. Rejects unknown keys, wrong types and non-finite floats. Does not own value ranges; GameConfig.validate() does.
import math
import typing
from dataclasses import fields, is_dataclass

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    StrictInt,
    create_model,
    model_validator,
)
from pydantic_core import PydanticCustomError

from game_config import GameConfig

_MODEL_CONFIG = ConfigDict(extra="forbid", coerce_numbers_to_str=True, allow_inf_nan=False)
_MODEL_CACHE: dict[type, type[BaseModel]] = {}
_NON_FINITE_SENTINEL = "<non-finite>"


def _sanitize_non_finite(value):
    # Pydantic echoes the rejected input in 422 payloads; Starlette's
    # JSONResponse cannot serialize NaN/inf, so echo a JSON-safe sentinel.
    if isinstance(value, float) and not math.isfinite(value):
        return _NON_FINITE_SENTINEL
    if isinstance(value, dict):
        return {key: _sanitize_non_finite(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_sanitize_non_finite(item) for item in value]
    return value


def _reject_non_finite_string(value):
    if value == _NON_FINITE_SENTINEL:
        # A plain ValueError would put the exception object into the 422
        # payload, which Starlette cannot serialize as JSON.
        raise PydanticCustomError("finite_number", "Input should be a finite number")
    return value


_FINITE_STR = typing.Annotated[str, BeforeValidator(_reject_non_finite_string)]


class _PatchBase(BaseModel):
    model_config = _MODEL_CONFIG

    @model_validator(mode="before")
    @classmethod
    def sanitize_non_finite_input(cls, data):
        return _sanitize_non_finite(data)


def _patch_annotation(annotation: object) -> object:
    """Keep the real type; fields are optional via a None default, so explicit nulls are rejected."""
    if annotation is int:
        return StrictInt
    if annotation is str:
        return _FINITE_STR
    origin = typing.get_origin(annotation)
    if origin is list:
        args = typing.get_args(annotation)
        item_type = args[0] if args else None
        if item_type is not None and is_dataclass(item_type):
            return list[_patch_model(item_type)]
        return annotation
    if is_dataclass(annotation):
        return _patch_model(annotation)
    return annotation


def _patch_model(dataclass_type: type, name: str | None = None) -> type[BaseModel]:
    cached = _MODEL_CACHE.get(dataclass_type)
    if cached is not None:
        return cached
    hints = typing.get_type_hints(dataclass_type)
    model = create_model(
        name or f"{dataclass_type.__name__}Patch",
        __base__=_PatchBase,
        **{
            item.name: (_patch_annotation(hints[item.name]), None)
            for item in fields(dataclass_type)
        },
    )
    _MODEL_CACHE[dataclass_type] = model
    return model


AdminConfigPatch = _patch_model(GameConfig, "AdminConfigPatch")
