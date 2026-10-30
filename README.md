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

E2E smoke-тесты идут против production-сборки: `npm run test:e2e` сначала сам
собирает бандл через npm lifecycle-хук `pretest:e2e` (`npm run build`), а затем
Playwright поднимает backend на `:8000` и `vite preview` на `:5173`
(`npm run preview:e2e`). Same-origin запросы `/ws` (WebSocket и admin API)
проксируются на backend через `preview.proxy` в `vite.config.ts`. Build вынесен
из `webServer`, поэтому Playwright управляет ровно одним процессом preview и
корректно его останавливает. Сценарии: `login → HUD → качество`, реальная
смерть от чёрной дыры → respawn, spectator-режим, admin login/logout и
`security.spec.ts` (Origin allowlist, spectator flood, role caps).

E2E принудительно стартует каждый контекст в `low` quality: в headless Linux CI
нет GPU, WebGL идёт через software-рендерер SwiftShader, и на `auto`/`high`
первый кадр занимает секунды. Тесты проверяют поведение, а не картинку, поэтому
`playwright.config.ts` задаёт `snake-quality=low` через `storageState`
(только localStorage; cookie игрока по-прежнему выдаёт backend после
`POST /session`). Таймауты (120 с на тест, 60 с на assertion) рассчитаны на
холодный SwiftShader, когда даже cheap-пресету нужно ~15 с до canvas и ~25 с до
статуса "Live".

```bash
cd frontend
npx playwright install chromium   # один раз на машину
npm run test:e2e                  # build + preview + тесты
```

Хук `pretest:e2e` срабатывает только у `npm run test:e2e`; при прямом запуске
`npx playwright test` или `npm run test:e2e:ui` сборку нужно сделать вручную
(`npm run build`).

Перед первым запуском на Linux CI браузер ставится с системными зависимостями:
`npx playwright install --with-deps chromium`. Playwright всегда поднимает свой
backend на `:8000` с `ADMIN_PASSWORD=e2e-admin`; если локальный backend уже
запущен, остановите его. Backend получает временную копию `backend/config.json`
через `CONFIG_PATH`, поэтому изменения конфига из E2E не трогают файл в репозитории.

Для production-E2E нужен свободный порт `5173`: `preview:e2e` запускается с
`--strictPort`, поэтому занятый порт — это явная ошибка, а не тихий переход на
другой. Локально `reuseExistingServer` включён (`!CI`), поэтому уже запущенный
на этом порту сервер будет переиспользован как есть — включая dev-сервер, что
нарушает требование гонять тесты против production-сборки (build из
`pretest:e2e` при этом всё равно выполняется). Остановите старый `vite`/`preview`
на `5173` перед запуском. Другой backend можно указать через `E2E_BACKEND_URL`
(по умолчанию `http://127.0.0.1:8000`), он прокидывается и в specs, и в proxy.

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
backend — `8000`. `docker-compose.yml` передаёт в backend
`ALLOWED_ORIGINS=${ALLOWED_ORIGINS-http://localhost:3000,http://127.0.0.1:3000}`:
переменная из `.env` имеет приоритет, а явно пустое значение отключает
браузерные origin (single-dash сохраняет пустую строку, `:-` подставил бы
default). Если frontend опубликован на другом порту (`FRONTEND_PORT`) или за
доменом, задайте `ALLOWED_ORIGINS` (например, `http://localhost:8080` или
`https://game.example`), иначе браузерные REST/WS-запросы будут отклонены.

Локальные переопределения не коммитятся: `.env.*` (кроме `.env.example`),
`docker-compose.override.yml`, `compose.override.yaml` и
`backend/config.local.json`. Путь к локальному конфигу backend задаётся через
`CONFIG_PATH` (например, `CONFIG_PATH=config.local.json` при запуске из
`backend/`).

### WebSocket и CORS

Браузерные `Origin` проверяются по точному списку; REST CORS использует тот же
список. `start_dev.bat` задаёт dev-дефолт с localhost/127.0.0.1 и LAN-origin,
production-дефолт — `http://localhost:3000` и `http://127.0.0.1:3000`.

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | dev/prod-список выше | Comma-separated allowlist; пустое значение запрещает браузерные origin. |
| `TRUST_PROXY_HEADERS` | `1` в production, иначе `0` | Доверять `X-Real-IP`/`X-Forwarded-For` (только за nginx). |
| `MAX_PLAYER_CONNECTIONS` | `50` | Максимум активных player-соединений (takeover не блокируется). |
| `MAX_SPECTATOR_CONNECTIONS` | `100` | Максимум spectator-соединений; не занимает player-слоты. |
| `WS_HANDSHAKE_RATE_LIMIT` | `30` | Handshake-попыток на IP за окно; отказ — close `4029`. |
| `WS_HANDSHAKE_WINDOW_SECONDS` | `10` | Окно per-IP rate limit. |

Если оставить `TRUST_PROXY_HEADERS=0` в production за nginx, backend будет
видеть IP nginx у всех клиентов: все браузеры попадут в один handshake-bucket и
быстро получат `4029`. Доверять `X-Real-IP`/`X-Forwarded-For` нужно только когда
backend недоступен напрямую (штатный compose/nginx).

## Документация

- `PROJECT_MAP.md` — структура и ответственность файлов.
- `ARCHITECTURE.md` — потоки данных и межстековые инварианты.
- `GAME_STATE.md` — статус механик и история исправлений.
- `.opencode/instructions/project.md` — правила разработки для OpenCode.
