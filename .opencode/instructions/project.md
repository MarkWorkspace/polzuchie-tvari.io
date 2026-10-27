# Polzuchie-tvari.io — project instructions

## What this is

Browser multiplayer snake game: FastAPI backend + Vite/TypeScript/Three.js frontend.
The authoritative project docs are:

- `PROJECT_MAP.md` — file map and responsibilities.
- `ARCHITECTURE.md` — data flows and cross-stack invariants.
- `GAME_STATE.md` — implemented features, historical fixes, known risks.

Read the relevant section of these files before changing a data flow. Update
`PROJECT_MAP.md` after structural file changes and `GAME_STATE.md` after
behavioral fixes.

## Commands

Backend (run from `backend/`, requires `uv` >= 0.11.2):

```bash
uv sync
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pytest tests/ -q
uv run --frozen python tests/generate_frame_fixtures.py   # only after an intentional frame-format change
```

Frontend (run from `frontend/`):

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Local development: `start_dev.bat` runs `uv sync` and starts backend on `:8000`
plus Vite on `:5173`.

## Git hooks

Install the shared hooks once per clone:

```bash
uv sync --project backend
uv run --project backend pre-commit install
```

`default_install_hook_types` installs both `pre-commit` and `pre-push` hooks.
On commit, only the affected stack's checks run (Ruff/pytest for backend
changes, Biome/tsc/Vitest for frontend changes). On push, the full backend
format/lint + tests, full frontend lint/typecheck/tests and production build
run. To run them manually:

```bash
uv run --project backend python scripts/run_checks.py all
```


## Hard invariants

1. Toroidal math is duplicated only in `frontend/src/worker/shared/MathUtils.ts`
   and `backend/app/engine/systems/math_utils.py`. Change them together and keep
   the golden-vector parity tests green.
2. The network frame is defined by `tests_shared/snake.proto`,
   `backend/app/engine/systems/serialization.py`,
   `frontend/src/worker/shared/ProtoFrameDecoder.ts` and
   `frontend/src/worker/DeltaDecoder.ts`. Change all involved sides together.
   If the serialized frame changes intentionally, regenerate and review
   `tests_shared/golden_frames/`.
3. Player bodies are flat arrays `[x0, y0, x1, y1, ...]` with the head first.
   The server reverses `new_heads_this_tick` after the tick; do not change that
   ordering without changing `getNewBody` in `DeltaDecoder.ts`.
4. Server positions are in map-grid units. Client world units are
   `grid * gridSize` with `gridSize = 20`. Server spatial cells use
   `CELL_SIZE = 10`. Fog/AoI conversion uses `world / 20`. Keep both sides
   consistent.
5. A spectator must never reuse a player's `client_id`. Spectator identity is
   independent from player reconnect identity.
6. Black-hole timers/growth are advanced once per tick by the orchestrator
   (`app/engine/game.py`), not again inside `gravity.py`.
7. `World.reset_state()` must clear tombstones, spectators, input queue and
   per-tick caches as well as players/food/world elements.
8. Admin password auth is cookie-based. Never store the admin password in
   `localStorage` or send it in custom headers.

## Conventions

- First line of every source file is a `ROLE:` comment (`// ROLE:` for
  TypeScript, `# ROLE:` for Python) describing what it does and what it does not do.
- Keep files focused: one responsibility per file. Split god files instead of
  growing them. Keep functions small and prefer extracting pure helpers.
- Styles live in `frontend/src/styles/*.css`; avoid adding inline style objects
  in TypeScript except dynamic values (opacity, transforms).
- Never edit generated files manually: `backend/app/engine/systems/snake_pb2.py`.
  `backend/config.json` is runtime state written by the admin panel; edit
  configuration through the admin API, not by hand.
- Add a regression test before or with every bug fix. Backend tests use pytest
  in `backend/tests/`; frontend tests use Vitest in
  `frontend/src/**/*.test.{ts,tsx}`.
- For cross-stack changes, add/update parity tests or golden fixtures rather
  than relying on manual checks.
- Prefer focused diffs. Do not reformat unrelated files or delete unfamiliar
  work without checking it first.
