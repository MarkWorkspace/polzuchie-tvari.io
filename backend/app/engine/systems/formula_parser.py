# ROLE: Единственный AST compile/eval формул роста: validation и runtime используют один код.
import ast
import functools
import math
from dataclasses import dataclass, field
from types import CodeType

MIN_GROWTH_COST = 0.1
MAX_GROWTH_COST = 1_000_000.0
CACHE_SIZE = 128

_BASELINE = (10.0, 9.0)
_HIGH = (1000.0, 100.0)

_ALLOWED_NAMES = frozenset(
    {
        "s",
        "S",
        "score",
        "SCORE",
        "l",
        "L",
        "len",
        "LEN",
        "length",
        "LENGTH",
        "pi",
        "e",
    }
)
_ALLOWED_FUNCTIONS = frozenset(
    {
        "log",
        "log10",
        "sin",
        "cos",
        "tan",
        "sqrt",
        "exp",
        "abs",
        "min",
        "max",
        "pow",
    }
)
_ALLOWED_BINOPS = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod, ast.Pow)
_ALLOWED_UNARYOPS = (ast.UAdd, ast.USub)
_ALLOWED_OPERATOR_NODES = (
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.Mod,
    ast.Pow,
    ast.UAdd,
    ast.USub,
)


class FormulaError(ValueError):
    """Growth formula is invalid or cannot be evaluated at runtime."""


@dataclass(frozen=True, slots=True)
class CompiledFormula:
    expression: str
    _code: CodeType = field(repr=False, compare=False)

    def evaluate(self, score: float, length: float) -> float:
        return _evaluate_code(self._code, score, length)

    def __call__(self, score: float, length: float) -> float:
        return self.evaluate(score, length)


def compile_growth_formula(expression: str) -> CompiledFormula:
    """Validate and compile a growth formula once; runtime reuses the same AST."""
    return _compile_cached(str(expression))


@functools.lru_cache(maxsize=CACHE_SIZE)
def _compile_cached(expression: str) -> CompiledFormula:
    _validate_numeric_constant(expression)

    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Syntax error in formula: {exc}") from exc

    _validate_tree(tree)

    try:
        code = compile(tree, "<growth_formula>", "eval")
    except (SyntaxError, TypeError, ValueError) as exc:
        raise ValueError(f"Syntax error in formula: {exc}") from exc

    for score, length in (_BASELINE, _HIGH):
        value = _evaluate_code(code, score, length)
        if value <= 0:
            raise ValueError("Formula must evaluate to a positive growth cost (greater than 0)")

    return CompiledFormula(expression, code)


def evaluate_formula(formula, score: float, length: float) -> float:
    """Evaluate a formula through the same compiled AST used by validation.

    There is no silent fallback: division by zero, overflow and non-finite
    results are reported as FormulaError (a ValueError).
    """
    compiled = compile_growth_formula(formula)
    return max(MIN_GROWTH_COST, compiled.evaluate(score, length))


def _validate_numeric_constant(expression: str) -> None:
    try:
        value = float(expression)
    except (TypeError, ValueError, OverflowError):
        return

    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False

    if not finite or value < MIN_GROWTH_COST or value > MAX_GROWTH_COST:
        raise ValueError("Growth segment cost must be between 0.1 and 1,000,000")


def _validate_tree(tree: ast.Expression) -> None:
    for node in ast.walk(tree):
        if isinstance(node, ast.Expression):
            continue
        if isinstance(node, ast.BinOp):
            if not isinstance(node.op, _ALLOWED_BINOPS):
                raise ValueError(f"Operator '{type(node.op).__name__}' is not allowed in formula")
        elif isinstance(node, ast.UnaryOp):
            if not isinstance(node.op, _ALLOWED_UNARYOPS):
                raise ValueError(f"Unary operator '{type(node.op).__name__}' is not allowed")
        elif isinstance(node, ast.Constant):
            _validate_constant(node)
        elif isinstance(node, ast.Name):
            if node.id not in _ALLOWED_NAMES and node.id not in _ALLOWED_FUNCTIONS:
                raise ValueError(
                    f"Variable or math constant '{node.id}' is not allowed. "
                    "Use s (score) or l (length)"
                )
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCTIONS:
                func_name = (
                    node.func.id if isinstance(node.func, ast.Name) else "complex expression"
                )
                raise ValueError(
                    f"Math function '{func_name}' is not allowed. "
                    f"Allowed: {', '.join(sorted(_ALLOWED_FUNCTIONS))}"
                )
            if node.keywords:
                raise ValueError("Keyword arguments are not allowed in formula")
        elif isinstance(node, ast.Load):
            continue
        elif isinstance(node, _ALLOWED_OPERATOR_NODES):
            continue
        else:
            raise ValueError(f"Expression type '{type(node).__name__}' is not allowed in formula")


def _validate_constant(node: ast.Constant) -> None:
    value = node.value
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Constant '{value!r}' is not allowed in formula")
    try:
        finite = math.isfinite(value)
    except OverflowError:
        finite = False
    if not finite:
        raise ValueError("Formula constants must be finite")


def _safe_log(value: float) -> float:
    return math.log(max(0.001, value))


def _safe_log10(value: float) -> float:
    return math.log10(max(0.001, value))


def _safe_sqrt(value: float) -> float:
    return math.sqrt(max(0.0, value))


_STATIC_ENV = {
    "pi": math.pi,
    "e": math.e,
    "log": _safe_log,
    "log10": _safe_log10,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "sqrt": _safe_sqrt,
    "exp": math.exp,
    "abs": abs,
    "min": min,
    "max": max,
    "pow": math.pow,
}


def _build_env(score: float, length: float) -> dict:
    try:
        score_value = float(score)
        length_value = float(length)
    except (TypeError, ValueError, OverflowError) as exc:
        raise FormulaError(f"Invalid score/length for growth formula: {exc}") from exc

    env = dict(_STATIC_ENV)
    env.update(
        {
            "s": score_value,
            "S": score_value,
            "score": score_value,
            "SCORE": score_value,
            "l": length_value,
            "L": length_value,
            "len": length_value,
            "LEN": length_value,
            "length": length_value,
            "LENGTH": length_value,
        }
    )
    return env


def _evaluate_code(code: CodeType, score: float, length: float) -> float:
    env = _build_env(score, length)
    try:
        value = eval(code, {"__builtins__": {}}, env)
    except Exception as exc:
        raise FormulaError(f"Failed to evaluate formula: {exc}") from exc

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise FormulaError("Formula must evaluate to a valid finite number")
    try:
        value = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise FormulaError("Formula must evaluate to a valid finite number") from exc
    if not math.isfinite(value):
        raise FormulaError("Formula must evaluate to a valid finite number")
    return value
