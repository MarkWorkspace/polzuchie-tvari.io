# Polzuchie-tvari.io

Браузерная многопользовательская игра «змейка»: авторитетная симуляция на
FastAPI, рендеринг на Three.js и вычисления геометрии в Web Worker.

## Стек

- **Backend:** Python 3.13, FastAPI, WebSocket, Protobuf, uv.
- **Frontend:** TypeScript, React 19 (admin + game HUD/overlays), Vite, Three.js, Web Worker, Vitest.
- **Данные:** общая Protobuf-схема и golden-фикстуры в `tests_shared/`.

## Быстрый старт

Требования: Python 3.13, [uv](https://docs.astral.sh/uv/) >= 0.11.2, Node.js 22
и npm.

```bash
uv sync --project backend
cd frontend && npm ci && cd ..
start_dev.bat
```

Backend: http://localhost:8000 (`/health`), frontend: http://localhost:5173.

Ручной запуск:

```bash
# backend
cd backend
uv run --frozen uvicorn server:app --host 0.0.0.0 --port 8000 --reload \
  --ws-per-message-deflate false --ws-max-size 4096

# frontend
cd frontend
npm run dev:host
```

Флаги WebSocket обязательны: кадры уже сжимаются zlib в приложении, поэтому
`permessage-deflate` только тратит CPU; клиентские команды не превышают 32 байт.

Админка доступна по `/admin` (или `/?admin=true`); для production nginx
проксирует `/ws` на backend. Игровой спектатор — `/?spectator=true` (клик по
игроку в таблице включает слежение), админский debug-спектатор — `/?spectator=debug`.
По умолчанию сервер держит 3 ботов; включение, количество и задержка респавна
меняются в админке на вкладке **Bots**. Там же режим характеров: mixed,
collector, aggressive или coward.

## Проверки

```bash
# всё сразу: backend format/lint + pytest, frontend lint/typecheck + vitest + build
uv run --project backend python scripts/run_checks.py all
```

После изменения Python-зависимостей обновите lockfile:

```bash
cd backend
uv lock
```

После изменения `tests_shared/snake.proto` перегенерируйте Python-код:

```bash
cd backend
uv run --frozen python scripts/generate_proto.py
```

По отдельности:

```bash
cd backend
uv run --frozen ruff format --check .
uv run --frozen ruff check .
uv run --frozen pytest tests/ -q

cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

E2E smoke-тесты идут против production-сборки (`npm run build` + `vite preview`).
Playwright сам поднимает backend на `:8000` и preview на `:5173`; same-origin
запросы `/ws` (WebSocket и admin API) проксируются на backend через
`preview.proxy` в `vite.config.ts`. Сценарии: `login → HUD → качество`, реальная
смерть от чёрной дыры → respawn, spectator-режим и admin login/logout.

```bash
cd frontend
npx playwright install chromium   # один раз на машину
npm run test:e2e
```

Перед первым запуском на Linux CI браузер ставится с системными зависимостями:
`npx playwright install --with-deps chromium`. Playwright всегда поднимает свой
backend на `:8000` с `ADMIN_PASSWORD=e2e-admin`; если локальный backend уже
запущен, остановите его. Backend получает временную копию `backend/config.json`
через `CONFIG_PATH`, поэтому изменения конфига из E2E не трогают файл в репозитории.

Для production-E2E нужен свободный порт `5173`: локально `reuseExistingServer`
включён (`!CI`), поэтому уже запущенный на этом порту сервер будет
использован как есть. Остановите старый `vite`/`preview` или задайте другой
порт. Другой backend можно указать через `E2E_BACKEND_URL` (по умолчанию
`http://127.0.0.1:8000`), он прокидывается и в specs, и в proxy.

### CI checks

GitHub Actions (`.github/workflows/ci.yml`) запускается на push и PR в `main` и
`dev`, на push в ветки `remediation/**`, а также вручную (`workflow_dispatch`). Jobs:

- **backend** — `uv lock --check`, Ruff format/lint, проверка актуальности
  сгенерированного protobuf, pytest и `pip-audit`;
- **frontend** — lint, typecheck, `npm audit`, production build и Vitest;
- **e2e** — Playwright smoke-тесты на Chromium (отчёты загружаются при падении);
- **docker** — `docker compose config` и сборка backend/frontend образов.

Локально backend и frontend проверки запускаются одной командой
`uv run --project backend python scripts/run_checks.py all`; E2E и Docker —
командами из разделов выше и ниже.

## Git hooks

```bash
uv sync --project backend
uv run --project backend pre-commit install
```

На коммит запускаются Ruff/Biome и тесты затронутого стека; на пуш — полный
backend format/lint + pytest, frontend lint/typecheck + vitest и production build.
Playwright E2E запускается в CI отдельным job.

## Docker

Задайте `ADMIN_PASSWORD` в `.env` (без него production-админка недоступна):

```bash
docker compose up --build
```

Порты по умолчанию опубликованы только на `127.0.0.1`: frontend — `3000`,
backend — `8000`.

Локальные переопределения не коммитятся: `.env.*` (кроме `.env.example`),
`docker-compose.override.yml`, `compose.override.yaml` и
`backend/config.local.json`. Путь к локальному конфигу backend задаётся через
`CONFIG_PATH` (например, `CONFIG_PATH=config.local.json` при запуске из
`backend/`).

## Документация

- `PROJECT_MAP.md` — структура и ответственность файлов.
- `ARCHITECTURE.md` — потоки данных и межстековые инварианты.
- `GAME_STATE.md` — статус механик и история исправлений.
- `.opencode/instructions/project.md` — правила разработки для OpenCode.
