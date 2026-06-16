// ROLE: Парсер формул роста. ЕДИНСТВЕННАЯ копия — импортируется только воркером.

const tokenCache = new Map<string, string[]>();

export class FormulaParser {
  private tokens: string[] = [];
  private pos = 0;

  constructor(expression: string, s: number, l: number) {
    if (!tokenCache.has(expression)) {
      const regex = /\d+(?:\.\d+)?|[a-z_][a-z0-9_]*|[\+\-\*\/\^,\(\)]/gi;
      tokenCache.set(expression, expression.match(regex) || []);
    }
    this.tokens = [...tokenCache.get(expression)!];
    this.pos = 0;
    
    for (let i = 0; i < this.tokens.length; i++) {
      const t = this.tokens[i].toLowerCase();
      if (t === "s" || t === "score") {
        this.tokens[i] = String(s);
      } else if (t === "l" || t === "len" || t === "length") {
        this.tokens[i] = String(l);
      } else if (t === "pi") {
        this.tokens[i] = String(Math.PI);
      } else if (t === "e") {
        this.tokens[i] = String(Math.E);
      }
    }
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(expected?: string): string {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");
    if (expected && token !== expected) throw new Error(`Expected token ${expected}`);
    this.pos++;
    return token;
  }

  public parse(): number {
    try {
      const val = this.parseExpression();
      if (this.peek() !== null) throw new Error("Extra tokens at end");
      return isNaN(val) ? 10.0 : val;
    } catch {
      return 10.0;
    }
  }

  private parseExpression(): number {
    let val = this.parseTerm();
    while (true) {
      const op = this.peek();
      if (op === "+" || op === "-") {
        this.consume();
        const rhs = this.parseTerm();
        val = op === "+" ? val + rhs : val - rhs;
      } else {
        break;
      }
    }
    return val;
  }

  private parseTerm(): number {
    let val = this.parseFactor();
    while (true) {
      const op = this.peek();
      if (op === "*" || op === "/") {
        this.consume();
        const rhs = this.parseFactor();
        val = op === "*" ? val * rhs : val / (rhs === 0 ? 0.001 : rhs);
      } else {
        break;
      }
    }
    return val;
  }

  private parseFactor(): number {
    let val = this.parsePrimary();
    while (this.peek() === "^") {
      this.consume();
      const exponent = this.parsePrimary();
      val = Math.pow(val, exponent);
    }
    return val;
  }

  private parsePrimary(): number {
    const token = this.consume();
    if (token === "(") {
      const val = this.parseExpression();
      this.consume(")");
      return val;
    }
    if (token === "-") return -this.parsePrimary();
    if (token === "+") return this.parsePrimary();

    const num = Number(token);
    if (!isNaN(num)) return num;

    return this.parseFunction(token.toLowerCase());
  }

  private parseFunction(func: string): number {
    if (!["sin", "cos", "tan", "log", "log10", "sqrt", "abs", "exp", "min", "max", "pow"].includes(func)) {
      return 0.0;
    }
    this.consume("(");
    const args: number[] = [];
    args.push(this.parseExpression());
    while (this.peek() === ",") {
      this.consume();
      args.push(this.parseExpression());
    }
    this.consume(")");

    switch (func) {
      case "sin": return Math.sin(args[0]);
      case "cos": return Math.cos(args[0]);
      case "tan": return Math.tan(args[0]);
      case "log": return Math.log(Math.max(0.001, args[0]));
      case "log10": return Math.log10(Math.max(0.001, args[0]));
      case "sqrt": return Math.sqrt(Math.max(0.0, args[0]));
      case "abs": return Math.abs(args[0]);
      case "exp": return Math.exp(args[0]);
      case "min": return Math.min(...args);
      case "max": return Math.max(...args);
      case "pow": return Math.pow(args[0], args[1] || 0);
    }
    return 0.0;
  }
}

export function evaluateFormula(formula: string | number, score: number, length: number): number {
  if (typeof formula === "number") return formula;
  if (!formula || formula === "") return 10.0;
  const parser = new FormulaParser(formula, score, length);
  const result = parser.parse();
  return Math.max(0.1, result);
}
