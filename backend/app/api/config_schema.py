# ROLE: Admin config PATCH schema derived from the GameConfig dataclasses. Rejects unknown keys, wrong types and non-finite floats. Does not own value ranges; GameConfig.validate() does.
import math
import typing
from dataclasses import fields, is_dataclass

from pydantic import BaseModel, BeforeValidator, ConfigDict, create_model

from game_config import GameConfig

_MODEL_CONFIG = ConfigDict(extra="forbid", coerce_numbers_to_str=True, allow_inf_nan=False)
_MODEL_CACHE: dict[type, type[BaseModel]] = {}


def _sanitize_non_finite_input(value):
    # Pydantic echoes the rejected input in 422 payloads; Starlette's
    # JSONResponse cannot serialize NaN/inf, so echo it as a string instead.
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value


_FINITE_FLOAT = typing.Annotated[float, BeforeValidator(_sanitize_non_finite_input)]


def _patch_annotation(annotation: object) -> object:
    """Keep the real type; fields are optional via a None default, so explicit nulls are rejected."""
    if annotation is float:
        return _FINITE_FLOAT
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
        __config__=_MODEL_CONFIG,
        **{
            item.name: (_patch_annotation(hints[item.name]), None)
            for item in fields(dataclass_type)
        },
    )
    _MODEL_CACHE[dataclass_type] = model
    return model


AdminConfigPatch = _patch_model(GameConfig, "AdminConfigPatch")
