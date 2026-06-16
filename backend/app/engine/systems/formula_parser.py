# ROLE: Парсер формул роста. Точная копия логики из FormulaParser.ts.
import re
import math


_TOKEN_CACHE = {}


class FormulaParser:
    def __init__(self, expression: str, s: float, l: float):
        if expression not in _TOKEN_CACHE:
            regex = r"\d+(?:\.\d+)?|[a-z_][a-z0-9_]*|[\+\-\*\/\^,\(\)]"
            _TOKEN_CACHE[expression] = re.findall(regex, expression, re.IGNORECASE)
        
        self.tokens = list(_TOKEN_CACHE[expression])
        self.pos = 0

        for i in range(len(self.tokens)):
            t = self.tokens[i].lower()
            if t in ("s", "score"):
                self.tokens[i] = str(s)
            elif t in ("l", "len", "length"):
                self.tokens[i] = str(l)
            elif t == "pi":
                self.tokens[i] = str(math.pi)
            elif t == "e":
                self.tokens[i] = str(math.e)

    def peek(self) -> str:
        return self.tokens[self.pos] if self.pos < len(self.tokens) else None

    def consume(self, expected: str = None) -> str:
        token = self.peek()
        if token is None:
            raise ValueError("Unexpected end of expression")
        if expected and token != expected:
            raise ValueError(f"Expected token {expected}")
        self.pos += 1
        return token

    def parse(self) -> float:
        try:
            val = self.parse_expression()
            if self.peek() is not None:
                raise ValueError("Extra tokens at end")
            if math.isnan(val):
                return 10.0
            return val
        except Exception:
            return 10.0

    def parse_expression(self) -> float:
        val = self.parse_term()
        while True:
            op = self.peek()
            if op in ("+", "-"):
                self.consume()
                rhs = self.parse_term()
                val = val + rhs if op == "+" else val - rhs
            else:
                break
        return val

    def parse_term(self) -> float:
        val = self.parse_factor()
        while True:
            op = self.peek()
            if op in ("*", "/"):
                self.consume()
                rhs = self.parse_factor()
                if op == "*":
                    val *= rhs
                else:
                    val /= 0.001 if rhs == 0 else rhs
            else:
                break
        return val

    def parse_factor(self) -> float:
        val = self.parse_primary()
        while self.peek() == "^":
            self.consume()
            exponent = self.parse_primary()
            val = math.pow(val, exponent)
        return val

    def parse_primary(self) -> float:
        token = self.consume()
        if token == "(":
            val = self.parse_expression()
            self.consume(")")
            return val
        if token == "-":
            return -self.parse_primary()
        if token == "+":
            return self.parse_primary()

        try:
            num = float(token)
            return num
        except ValueError:
            pass

        return self.parse_function(token.lower())

    def parse_function(self, func: str) -> float:
        if func not in (
            "sin",
            "cos",
            "tan",
            "log",
            "log10",
            "sqrt",
            "abs",
            "exp",
            "min",
            "max",
            "pow",
        ):
            return 0.0

        self.consume("(")
        args = []
        args.append(self.parse_expression())
        while self.peek() == ",":
            self.consume()
            args.append(self.parse_expression())
        self.consume(")")

        if func == "sin":
            return math.sin(args[0])
        elif func == "cos":
            return math.cos(args[0])
        elif func == "tan":
            return math.tan(args[0])
        elif func == "log":
            return math.log(max(0.001, args[0]))
        elif func == "log10":
            return math.log10(max(0.001, args[0]))
        elif func == "sqrt":
            return math.sqrt(max(0.0, args[0]))
        elif func == "abs":
            return abs(args[0])
        elif func == "exp":
            return math.exp(args[0])
        elif func == "min":
            return min(args)
        elif func == "max":
            return max(args)
        elif func == "pow":
            return math.pow(args[0], args[1] if len(args) > 1 else 0)

        return 0.0


def evaluate_formula(formula, score: float, length: float) -> float:
    if isinstance(formula, (int, float)):
        return float(formula)
    if not formula:
        return 10.0
    parser = FormulaParser(str(formula), score, length)
    result = parser.parse()
    return max(0.1, result)
