---
description: Run the backend and frontend verification suites and report failures
---

Run the full verification suite for this repository. Do not change code just to
make checks pass; report failures with file and line references.

1. Backend lint: from `backend/`, run `uv run --frozen ruff check .`.
2. Backend tests: from `backend/`, run `uv run --frozen pytest tests/ -q`.
3. Frontend: from `frontend/`, run `npm test`.
4. Frontend build/typecheck: from `frontend/`, run `npm run build`.

If a command cannot run because a dependency is missing, say exactly what is
missing and continue with the checks that can run.
