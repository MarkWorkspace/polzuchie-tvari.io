---
description: Run the backend and frontend verification suites and report failures
---

Run the full verification suite for this repository. Do not change code just to
make checks pass; report failures with file and line references.

1. Backend format: from `backend/`, run `uv run --frozen ruff format --check .`.
2. Backend lint: from `backend/`, run `uv run --frozen ruff check .`.
3. Backend tests: from `backend/`, run `uv run --frozen pytest tests/ -q`.
4. Frontend lint: from `frontend/`, run `npm run lint`.
5. Frontend typecheck: from `frontend/`, run `npm run typecheck`.
6. Frontend tests: from `frontend/`, run `npm test`.
7. Frontend build: from `frontend/`, run `npm run build`.

If a command cannot run because a dependency is missing, say exactly what is
missing and continue with the checks that can run.
