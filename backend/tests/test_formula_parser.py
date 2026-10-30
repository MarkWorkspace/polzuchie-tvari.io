# ROLE: Tests for the single AST growth-formula compiler shared by validation and runtime.
import math

import pytest

from app.engine.state import World
from app.engine.systems.formula_parser import (
    compile_growth_formula,
    evaluate_formula,
)
from game_config import validate_growth_formula


VALID_FORMULAS = [
    "1",
    "10.5",
    "s",
    "s * 0.1",
    "s + l",
    "max(10, s)",
    "min(100, s * 2)",
    "sqrt(s)",
    "log(s)",
    "pow(s, 0.5)",
    "10 + (s * 2) / 5",
    "s ** 2",
    "s % 7",
    "10 % 3",
    "(s + l) ** 0.5",
    "length * 2",
    "len + LENGTH",
    "e",
    "pi",
    "-l + s",
    "+s",
    "abs(-s)",
]


@pytest.mark.parametrize("formula", VALID_FORMULAS)
def test_validate_growth_formula_accepts_valid_formulas(formula):
    World()

    validate_growth_formula(formula)


INVALID_FORMULAS = [
    "s ^ 2",
    "s & 1",
    "~s",
    "print(s)",
    "import os",
    "s = 10",
    "s; 1",
    "[s]",
    "{s: 1}",
    "lambda x: x",
    "s if True else l",
    "__import__('os')",
    "eval('1')",
    "True",
    "None",
    "'s'",
    "s.real",
    "s[0]",
    "s - s",
    "0 - s",
    "s * 0",
]


@pytest.mark.parametrize("formula", INVALID_FORMULAS)
def test_validate_growth_formula_rejects_invalid_formulas(formula):
    World()

    with pytest.raises(ValueError):
        validate_growth_formula(formula)


def test_invalid_function_message_is_stable():
    with pytest.raises(ValueError, match="Math function 'print' is not allowed"):
        validate_growth_formula("print(s)")


def test_invalid_variable_message_is_stable():
    with pytest.raises(ValueError, match="Variable or math constant 'x' is not allowed"):
        validate_growth_formula("x + 1")


@pytest.mark.parametrize("formula", ["0.1", "1000000", "1e6"])
def test_numeric_formula_accepts_bounds(formula):
    validate_growth_formula(formula)

    assert evaluate_formula(formula, 100.0, 20.0) == pytest.approx(float(formula))


@pytest.mark.parametrize("formula", ["0.05", "0", "-5", "1000000.1", "1e7"])
def test_numeric_formula_rejects_out_of_range(formula):
    with pytest.raises(ValueError, match="Growth segment cost must be between"):
        validate_growth_formula(formula)


@pytest.mark.parametrize("formula", ["1e309", "inf", "nan", "1e309 + 1"])
def test_non_finite_formula_is_rejected(formula):
    with pytest.raises(ValueError):
        validate_growth_formula(formula)
    with pytest.raises(ValueError):
        evaluate_formula(formula, 10.0, 9.0)


def test_non_finite_evaluation_result_is_rejected():
    with pytest.raises(ValueError):
        validate_growth_formula("s * 1e308 * 10")


@pytest.mark.parametrize("formula", [10, 10.5, "10", "10.5"])
def test_numeric_formula_compiles_as_constant(formula):
    assert evaluate_formula(formula, 100.0, 20.0) == pytest.approx(float(formula))


@pytest.mark.parametrize("alias", ["s", "S", "score", "SCORE"])
def test_score_aliases(alias):
    assert evaluate_formula(alias, 42.0, 7.0) == pytest.approx(42.0)


@pytest.mark.parametrize("alias", ["l", "L", "len", "LEN", "length", "LENGTH"])
def test_length_aliases(alias):
    assert evaluate_formula(alias, 42.0, 7.0) == pytest.approx(7.0)


DIFFERENTIAL_POINTS = [
    (10.0, 9.0),
    (1000.0, 100.0),
    (50.0, 20.0),
    (0.5, 3.0),
]

DIFFERENTIAL_FORMULAS = [
    ("s*0.1+7", lambda score, length: score * 0.1 + 7),
    ("s**0.5", lambda score, length: math.sqrt(score)),
    ("s % 7 + 1", lambda score, length: score % 7 + 1),
    ("(s+l)/3", lambda score, length: (score + length) / 3),
    ("max(10,s)", lambda score, length: max(10, score)),
]


@pytest.mark.parametrize(
    ("formula", "expected"),
    DIFFERENTIAL_FORMULAS,
    ids=[formula for formula, _ in DIFFERENTIAL_FORMULAS],
)
def test_evaluate_formula_matches_python_math(formula, expected):
    for score, length in DIFFERENTIAL_POINTS:
        assert evaluate_formula(formula, score, length) == pytest.approx(expected(score, length))


def test_validation_and_runtime_share_the_compiled_formula():
    compiled = compile_growth_formula("s % 7 + 1")

    validate_growth_formula("s % 7 + 1")

    assert compile_growth_formula("s % 7 + 1") is compiled
    assert evaluate_formula("s % 7 + 1", 10.0, 9.0) == pytest.approx(4.0)
    assert compiled.evaluate(10.0, 9.0) == pytest.approx(4.0)
    assert compiled(10.0, 9.0) == pytest.approx(4.0)


def test_runtime_result_is_clamped_to_minimum():
    assert evaluate_formula("s - 5", 0.0, 9.0) == pytest.approx(0.1)


def test_division_by_zero_is_rejected_at_validation():
    with pytest.raises(ValueError):
        validate_growth_formula("s / 0")


def test_division_by_zero_is_rejected_at_runtime():
    # Valid at the baseline/high validation points, but not at score == 0.
    validate_growth_formula("1 / s")

    with pytest.raises(ValueError):
        evaluate_formula("1 / s", 0.0, 9.0)


def test_overflow_is_rejected_at_runtime():
    validate_growth_formula("exp(l)")

    with pytest.raises(ValueError):
        evaluate_formula("exp(l)", 10.0, 1000.0)


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_runtime_non_finite_input_is_rejected(value):
    with pytest.raises(ValueError):
        evaluate_formula("s", value, 9.0)
