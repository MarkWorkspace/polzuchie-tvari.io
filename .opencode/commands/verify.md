---
description: Run the backend and frontend verification suites and report failures
---

Run the full verification suite for this repository. Do not change code just to
make checks pass; report failures with file and line references.

1. Backend: from `backend/`, run `python -m pytest tests/ -q`.
2. Frontend: from `frontend/`, run `npm test`.
3. Frontend build/typecheck: from `frontend/`, run `npm run build`.

If a command cannot run because a dependency is missing, say exactly what is
missing and continue with the checks that can run.
