#!/usr/bin/env python3
# ROLE: Cross-platform runner for local git-hook checks. Does not contain game logic.
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _python_for_backend() -> str:
    candidates = (
        ROOT / "backend/.venv/Scripts/python.exe",
        ROOT / "backend/.venv/bin/python",
    )
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return sys.executable


def _quote(value: str) -> str:
    return f'"{value}"' if " " in value else value


CHECKS = {
    "backend-format": (
        f"{_quote(_python_for_backend())} -m ruff format --check .",
        ROOT / "backend",
    ),
    "backend-lint": (
        f"{_quote(_python_for_backend())} -m ruff check .",
        ROOT / "backend",
    ),
    "backend-tests": (
        f"{_quote(_python_for_backend())} -m pytest tests -q",
        ROOT / "backend",
    ),
    "frontend-lint": ("npm run lint", ROOT / "frontend"),
    "frontend-typecheck": ("npm run typecheck", ROOT / "frontend"),
    "frontend-tests": ("npm test", ROOT / "frontend"),
    "frontend-build": ("npm run build", ROOT / "frontend"),
}

CHECK_ORDER = (
    "backend-format",
    "backend-lint",
    "backend-tests",
    "frontend-lint",
    "frontend-typecheck",
    "frontend-tests",
    "frontend-build",
)


def _run(name: str) -> None:
    command, cwd = CHECKS[name]
    if name.startswith("frontend") and not (ROOT / "frontend/node_modules").exists():
        raise SystemExit(
            "[checks] frontend/node_modules is missing. Run `npm ci` in frontend/ first."
        )
    print(f"[checks] {name}: {command} (cwd={cwd})")
    result = subprocess.run(command, cwd=str(cwd), shell=True)
    if result.returncode:
        raise SystemExit(result.returncode)


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print("Usage: python scripts/run_checks.py <check|all>")
        print("Checks:", ", ".join(CHECK_ORDER))
        return 0 if argv else 2

    if argv[0] == "all":
        selected = CHECK_ORDER
    elif argv[0] in CHECKS:
        selected = (argv[0],)
    else:
        print(f"Unknown check: {argv[0]}", file=sys.stderr)
        return 2

    for name in selected:
        _run(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
