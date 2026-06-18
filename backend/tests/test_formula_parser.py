import pytest
from app.engine.state import World
from game_config import validate_growth_formula

def test_formula_parser_valid():
    state = World()
    
    # These should pass without ValueError
    valid_formulas = [
        "1",
        "s",
        "s * 0.1",
        "s + l",
        "max(10, s)",
        "min(100, s * 2)",
        "sqrt(s)",
        "log(s)",
        "pow(s, 0.5)",
        "10 + (s * 2) / 5"
    ]
    
    for formula in valid_formulas:
        try:
            validate_growth_formula(formula)
        except ValueError as e:
            pytest.fail(f"Valid formula '{formula}' raised ValueError: {e}")

def test_formula_parser_invalid():
    state = World()
    
    invalid_formulas = [
        "import os",
        "__import__('os')",
        "eval('1')",
        "s = 10",
        "s ** 2", # valid actually wait, pow is allowed, ** is Pow, let's see if ** is allowed
        "s; 1",
        "s if True else l",
        "[s]",
        "{s: 1}",
        "lambda x: x"
    ]
    
    for formula in invalid_formulas:
        # ** is Pow, it is allowed! So I should remove s ** 2 from invalid
        if "**" in formula:
            continue
            
        with pytest.raises(ValueError):
            validate_growth_formula(formula)

def test_formula_pow_is_allowed():
    try:
        validate_growth_formula("s ** 2")
        validate_growth_formula("pow(s, 2)")
    except ValueError as e:
        pytest.fail(f"Pow formula raised ValueError: {e}")

def test_formula_invalid_func():
    with pytest.raises(ValueError, match="Math function 'print' is not allowed"):
        validate_growth_formula("print(s)")
