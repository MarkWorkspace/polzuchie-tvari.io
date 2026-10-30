# План устранения архитектурного аудита

> Статус: draft for approval. Дата: 2026-10-30.
> Источник: пять read-only аудитов (backend, frontend, netcode, tests/CI/ops, code quality).
> Цель: превратить найденные риски в последовательность небольших проверяемых задач,
> где **одна задача = один субагент = один commit**.
> Номера строк — на момент аудита; перед каждой задачей перепроверять по текущему коду,
> потому что в репозитории идёт активная разработка.

---

## 0. Как читать этот план

План состоит из шести milestones. Внутри — task-карточки. Каждая карточка содержит:

- **ID, приоритет, зависимости, оценку**;
- **зачем** — какую проблему аудита закрывает;
- **allowlist** — файлы, которые разрешено менять (всё остальное — вне scope);
- **шаги** — что именно сделать;
- **тесты** — что добавить и какие команды запустить;
- **acceptance** — наблюдаемый результат, по которому задача принимается;
- **evidence** — команда/лог/скриншот/ручной чек-лист, доказывающий acceptance;
- **out of scope** — что сознательно не делаем в этой задаче.

Задачи выполняются **строго последовательно** по умолчанию. Параллелить можно только
задачи с непересекающимся allowlist и без зависимости, и только после явного решения
владельца проекта. Один субагент не получает две task-карточки одновременно.

---

## 1. Решения, которые нельзя пересматривать внутри задач

Эти решения зафиксированы заранее, чтобы субагенты не изобретали архитектуру по ходу.

| ID | Решение |
|---|---|
| **D1** | Идентичность игрока: публичный `player_id` отделён от секрета сессии. Сессия — HttpOnly cookie, выданная `POST /session`; WS не доверяет `client_id` из query. Spectator всегда получает новый UUID и никогда не переиспользует player ID. |
| **D2** | Изменения сетевого формата — только аддитивные `optional` поля. Старые клиенты должны продолжать декодировать кадры. Смысл существующего поля нельзя менять без нового флага/версии. `snake_pb2.py` может измениться только через `backend/scripts/generate_proto.py` в задаче, меняющей `snake.proto` (никогда руками); golden-фикстуры перегенерируются только в задачах, где это явно указано. |
| **D3** | Один владелец конфига — `World.config`. `Player.config` — не независимый снимок, а ссылка, которую `update_config` обязан перепривязать; производные поля сущностей обновляются через `apply_config()` при live-update. |
| **D4** | Единая функция `gridToWorld`/`worldToGrid` для всех сущностей, включая порталы и чёрные дыры. Тороидальная математика — только через общий helper; менять TS и Python вместе с golden vectors. |
| **D5** | События тика (`new_foods`, `kill_events`) очищаются в начале тика и живут до broadcast; удаления игроков обрабатываются внутри тика через единый `pending_removals`, а не второй параллельный механизм. |
| **D6** | Восстановление сети: `frame_seq` + команда `RESYNC`; потеря DELTA означает обязательный FULL, а не «продолжим как-нибудь». |
| **D7** | У ввода один владелец. UI-элементы (drawer, select, button, input) не должны рулить змейкой. |
| **D8** | Никаких новых runtime-зависимостей без отдельного согласования. Никаких «попутных» рефакторингов вне allowlist. |
| **D9** | Каждое поведенческое изменение сопровождается regression-тестом. Каждое изменение протокола — parity/golden-тестом. |
| **D10** | Субагент не коммитит. Родительская сессия проверяет diff, запускает gate-команды и делает commit. Один task — один commit. |

---

## 2. Протокол исполнения

### 2.1. Ветка и рабочее дерево

- Ветка: `remediation/audit-2026-10` от `dev`.
- Рекомендуется отдельный worktree (`remediation-audit`) от `dev`, чтобы не смешивать план с текущими правками пользователя.
- Перед каждой задачей: `git status --short` должен быть пуст. Если в дереве есть чужие незакоммиченные изменения — **не** делать stash/revert/checkout, остановиться и согласовать с владельцем.
- После каждой задачи: commit с префиксом `fix(...)`, `feat(...)`, `test(...)`, `docs(...)`, `chore(...)`.
- В конце milestone: полный gate и, при необходимости, merge/rebase на `dev`.

### 2.2. Что получает субагент

Субагент получает ровно одну карточку и промпт такого вида:

```text
Ты работаешь только над задачей <ID>.
1. Прочитай REMEDIATION_PLAN.md, PROJECT_MAP.md, ARCHITECTURE.md, GAME_STATE.md
   и файлы из allowlist.
2. Не меняй файлы вне allowlist. Не делай opportunistic refactor.
3. Сначала добавь/обнови regression test, затем минимальный fix.
4. Запусти указанные команды. Если падает что-то вне scope — остановись и сообщи.
5. Если нужно больше 8 файлов, есть архитектурная неоднозначность или
   требуется новая зависимость — остановись и задай вопрос.
6. Верни: summary, список файлов, команды и результаты, остаточные риски.
```

### 2.3. Что делает родитель после субагента

1. `git diff --stat` — сверить с allowlist.
2. `git diff --check` — пробелы/конфликты.
3. Запустить targeted tests из карточки.
4. Для P0/P1 задач — read-only reviewer-субагент: «найди баги, регрессии и пропущенные тесты; не редактируй».
5. Если есть замечания — вернуть их **тому же** субагенту (sessionID), максимум 2 круга.
6. Только после этого — commit.

### 2.4. Definition of Ready

Задача готова к запуску, если:

- зависимости merged;
- allowlist зафиксирован;
- acceptance сформулирован наблюдаемо;
- нет открытых design-вопросов (иначе сначала отдельная ADR-задача);
- есть тест, который можно сделать failing до фикса.

### 2.5. Definition of Done

- acceptance выполнен;
- новый тест падает без фикса и проходит с ним (где это технически возможно);
- targeted checks зелёные;
- diff не выходит за allowlist;
- docs обновлены, если изменилось поведение/протокол/структура;
- **Evidence** приложен: команда/тест/лог/скриншот/ручной чек-лист с конкретным результатом;
- отчёт субагента приложен;
- commit создан родителем.

**Standing allowlist.** Для любой задачи, меняющей поведение/протокол/структуру, дополнительно разрешены минимальные правки:

- `PROJECT_MAP.md` — регистрация новых/удалённых файлов;
- `GAME_STATE.md` — короткая запись о поведении/риске;
- `frontend/src/lib/i18n.ts` — новые UI-строки;
- `frontend/src/main.ts` — импорт CSS нового UI.

Эти файлы не считаются «расширением scope», но reviewer проверяет, что правки минимальны и по делу.

### 2.6. Stop-conditions

Субагент обязан остановиться и вернуть вопрос, если:

- требуется > 8 **production** файлов (тесты, golden, docs не считаются). Для заранее помеченных механических adoption-задач (M3-08, M3-09) допускается до 12 production файлов;
- обнаружена зависимость, которой нет в плане;
- падают тесты вне scope;
- в рабочем дереве есть незакоммиченные изменения вне allowlist (чужая работа);
- нужно менять golden-фикстуры, а задача этого не разрешает;
- нужно добавить зависимость;
- визуальный/поведенческий результат нельзя проверить автоматически, а ручной критерий не описан.

### 2.7. Hot files и полный прогон

Эти файлы нельзя параллелить; задачи, которые их трогают, требуют полного stack-прогона, а не только targeted tests:

```text
backend/app/api/websocket.py
backend/app/engine/state.py
backend/tests/test_frame_parity.py
frontend/src/worker/worker.ts
frontend/src/game/Game.ts
frontend/nginx.conf
backend/Dockerfile
tests_shared/golden_frames/*
```

Для hot files reviewer обязан проверить, что regression surface включает соседние системы (reconnect, spectator, restart, config, golden).

---

## 3. Milestones и порядок

| Milestone | Смысл | Задачи | Gate |
|---|---|---|---|
| **M0** | Безопасный baseline | M0-01, M0-02 | CI зелёный, тесты изолированы |
| **M1** | Безопасные сессии | M1-01…M1-05 | hijack невозможен, reconnect стабилен |
| **M2** | Один конфиг | M2-01…M2-05 | live-config и формулы согласованы |
| **M3** | Корректный netcode | M3-01…M3-13 | события не теряются, seq/resync, координаты |
| **M4** | Устойчивый frontend | M4-01…M4-05 | input/WebGL/worker/contracts |
| **M5** | Эксплуатация и docs | M5-01…M5-07 | health, backup, docs, runbook |
| **M6** | Масштабирование/рефакторинг | optional backlog | по отдельному решению |

Порядок внутри milestone — по номерам, кроме явно отмеченного `M3-12 → M3-11` (чтобы
не регенерировать golden дважды). По умолчанию M2 и M3 начинаются **после Gate 1**:
не строим config/netcode-изменения на нестабильной identity. Исключение — явное решение
владельца; M2-03/M2-04 трогают `game_config.py`, который нужен M1-тестам.

### Tracker

- [ ] M0-01 CI repair
- [ ] M0-02 Test isolation
- [ ] M1-01 Backend session store
- [ ] M1-02 WS auth
- [ ] M1-03 Frontend session plumbing
- [ ] M1-04 Reconnect epoch
- [ ] M1-05 Origin/limits + security E2E
- [ ] M2-01 Config ownership
- [ ] M2-02 Entity live-config
- [ ] M2-03 Validation hardening
- [ ] M2-04 Formula engine
- [ ] M2-05 Config persistence
- [ ] M3-01 Tick-boundary events
- [ ] M3-02 Backpressure
- [ ] M3-03 Body semantics
- [ ] M3-04 final_length
- [ ] M3-05 frame_seq backend
- [ ] M3-06 Frontend resync
- [ ] M3-07 Empty frame/requestId
- [ ] M3-08 gridToWorld
- [ ] M3-09 Torus helper
- [ ] M3-10 Full-frame writer
- [ ] M3-11 Golden fixtures
- [ ] M3-12 Spawn body wrap
- [ ] M3-13 Tombstone killfeed
- [ ] M4-01 Input ownership
- [ ] M4-02 WebGL context loss
- [ ] M4-03 Worker watchdog
- [ ] M4-04 Typed worker protocol
- [ ] M4-05 SnakeRenderer update ranges
- [ ] M5-01 Health/readiness
- [ ] M5-02 Admin audit/XFF
- [ ] M5-03 Docker/nginx hardening
- [ ] M5-04 Config deployment
- [ ] M5-05 Dead code removal
- [ ] M5-06 Docs sync
- [ ] M5-07 Runbook/SECURITY/ADRs
- [ ] M6 optional backlog (по решению)

---

# M0. Безопасный baseline

## M0-01 — Починить CI и сделать backend/E2E обязательными

- **Priority:** P0
- **Depends:** нет
- **Effort:** S
- **Проблема:** `.github/workflows/ci.yml:27,91` использует `astral-sh/setup-uv@v9`, которого не существует (есть `v9.0.0` и `v10.x`). Все доступные GitHub runs — failure; backend и E2E падают на `Set up job`, frontend и Docker зелёные.
- **Allowlist:** `.github/workflows/ci.yml`, `README.md`, `backend/Dockerfile`, `start_dev.bat` (только если uv-версию придётся поднять).
- **Шаги:**
  1. Заменить `astral-sh/setup-uv@v9` на существующий ref (`@v9.0.0` или `@v10.3.3`), затем закрепить SHA.
  2. Проверить, что `version: "0.11.2"` совместим с выбранным action; при необходимости обновить.
  3. Открыть draft PR в `dev` (push в `remediation/...` CI не триггерит, `ci.yml` слушает только `main`/`dev`); либо добавить ветку в triggers.
  4. Добавить `workflow_dispatch` для ручного прогона.
  5. Добавить в README короткий раздел «CI checks» и как запустить их локально.
  6. Не добавлять новые jobs/линтеры в этой задаче.
- **Тесты/проверка:**
  - Draft PR → все 4 job зелёные (или падения диагностированы и не связаны с setup).
  - `gh run list --branch remediation/audit-2026-10` или GitHub API: нет `failure` на setup.
  - Локально: `docker compose config --quiet`.
- **Acceptance:** backend и e2e jobs реально выполняют шаги, а не падают на setup; CI запускается на PR и зелёный. Если `pip-audit`/`npm audit` падают на advisory — зафиксировать отдельно, не отключать gate.
- **Out of scope:** coverage, новые линтеры, branch protection settings, CD.

## M0-02 — Изолировать тесты от runtime `backend/config.json`

- **Priority:** P0
- **Depends:** M0-01
- **Effort:** M
- **Проблема:** `World()` читает `CONFIG_PATH`/`backend/config.json`; golden-тесты и часть unit-тестов зависят от локальных админских правок. `frame_scenario.py` не фиксирует конфиг.
- **Allowlist:** `backend/tests/conftest.py` (new), `backend/tests/frame_scenario.py`, `backend/tests/fixtures/config_parity.json` (new), `backend/tests/test_test_isolation.py` (new), `backend/tests/generate_frame_fixtures.py`.
- **Шаги:**
  1. Создать `tests/fixtures/config_parity.json` — минимальный pinned-конфиг для parity-тестов.
  2. В `conftest.py` добавить autouse fixture: `monkeypatch.setenv("CONFIG_PATH", tmp_path/"config.json")`, копировать pinned-конфиг, очищать глобалы (`active_connections`, `pending_disconnects`, admin sessions/login attempts) и **отменять** pending tasks, чтобы не было `Task was destroyed`.
  3. `build_deterministic_world()` и `generate_frame_fixtures.py` должны явно использовать pinned-конфиг через `CONFIG_PATH`, а не repo `config.json`.
  4. Добавить тест: `world.config` в parity-сценарии соответствует pinned-значениям, даже если repo `config.json` изменён.
  5. Проверить, что golden `.bin`/`.expected.json` не изменились.
- **Тесты/проверка:**
  - `cd backend && uv run --frozen pytest tests/ -q`
  - `cd backend && uv run --frozen pytest tests/test_frame_parity.py tests/test_math_parity.py -q`
  - `cd backend && uv run --frozen python tests/generate_frame_fixtures.py` — не должен менять git diff.
  - Запуск тестов в обратном порядке / с `-p no:cacheprovider` не должен менять результат.
- **Acceptance:** тесты и генератор не зависят от содержимого tracked `backend/config.json`; golden стабильны; нет cross-test globals.
- **Out of scope:** перенос runtime-конфига в volume (M5-04), изменение production-кода.

---

# M1. Безопасные сессии

## M1-01 — Backend session store + `POST /session` cookie

- **Priority:** P0
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** `client_id` — единственный credential; IDs публичны (см. M1-02).
- **Allowlist:** `backend/app/api/session.py` (new), `backend/server.py`, `backend/app/api/websocket.py` (только чтение cookie/подготовка), `backend/tests/test_player_session.py` (new).
- **Дизайн (D1):**
  - `POST /session` создаёт/возвращает opaque session token в HttpOnly cookie **только для player**.
  - Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` если `X-Forwarded-Proto=https` (как в admin), `Path=/`, фиксированный TTL 30 дней.
  - Серверный store: `{token: {player_id, created_at, last_seen}}`; cap на число сессий + rate limit на endpoint + periodic cleanup.
  - `DELETE /session` очищает cookie и store.
  - Alias `/ws/session` для nginx-префикса; frontend в prod использует `/ws/session`, в dev — backend `:8000/session`.
  - Spectator **не получает player cookie**: WS для spectator всегда выдаёт новый UUID; player cookie игнорируется при role=spectator.
- **Шаги:**
  1. Реализовать store и endpoint с тестами.
  2. Добавить cookie-парсинг в WS (пока без полной замены `client_id` — это M1-02).
  3. Не логировать token; не отдавать его в JSON.
  4. Добавить TTL/cleanup и тест истечения.
- **Тесты:**
  - `TestClient` POST `/session` → `Set-Cookie` с HttpOnly/SameSite.
  - Повторный POST возвращает тот же player_id.
  - `DELETE /session` инвалидирует.
  - Spectator получает другой ID.
- **Acceptance:** cookie-сессия работает; token не утекает в ответ; TTL работает.
- **Merge/deploy unit:** M1-01 + M1-02 + M1-03 — одна deployable-единица. Не мержить в `dev` и не деплоить между ними: после M1-02 старый frontend ещё без cookie, и reconnect будет создавать нового игрока.
- **Out of scope:** frontend, Origin, per-IP limits, удаление `client_id` из WS (M1-02).

## M1-02 — WS auth: убрать доверие к `client_id`, закрыть hijack

- **Priority:** P0
- **Depends:** M1-01
- **Effort:** M
- **Проблема:** `backend/app/api/websocket.py:64-90` принимает любой UUID из `world.players`; `snake.proto:151` отдаёт ID всем.
- **Allowlist:** `backend/app/api/websocket.py`, `backend/app/engine/state.py` (только если нужен helper), `backend/tests/test_player_session.py`, `backend/tests/test_spectator_identity.py`.
- **Шаги:**
  1. WS читает cookie; `_validate_client` больше не принимает `client_id` из query как доказательство.
  2. Если cookie валидна и role=player → использовать `player_id` из сессии; reconnect разрешён.
  3. Если cookie нет/невалидна → новый UUID. Query `client_id` **никогда** не используется для auth (игнорируется; при наличии — warning в лог).
  4. Spectator всегда новый UUID; player cookie не переиспользуется.
  5. Обновить/добавить тест: подключение с чужим `client_id` без cookie не захватывает змею; с валидной cookie reconnect работает.
  6. Удалить/пометить deprecated query-параметр `client_id` в docs.
- **Тесты:**
  - `test_foreign_client_id_without_cookie_creates_new_player`
  - `test_valid_cookie_reconnects_same_player`
  - `test_spectator_never_uses_player_cookie`
  - `test_invalid_cookie_creates_new_identity`
- **Acceptance:** hijack-сценарий из аудита не воспроизводится; reconnect сохраняет змейку.
- **Out of scope:** frontend plumbing (M1-03), epoch (M1-04), Origin (M1-05).

## M1-03 — Frontend session plumbing

- **Priority:** P0
- **Depends:** M1-02
- **Effort:** M
- **Проблема:** `NetworkManager.buildWsUrl` кладёт `client_id` в URL и localStorage; после M1-02 клиент должен использовать cookie.
- **Allowlist:** `frontend/src/game/NetworkManager.ts`, `frontend/src/worker/WebSocketClient.ts`, `frontend/src/worker/worker.ts`, `frontend/src/game/bootstrap.ts`, `frontend/src/game/PlayerSessionLock.ts`, `frontend/src/game/Game.ts`, `frontend/src/game/SpectatorApp.ts`, `frontend/src/game/spectatorBootstrap.ts`, `frontend/src/ui/react/LoginScreen.tsx`, `frontend/src/lib/i18n.ts`, `frontend/e2e/game.spec.ts`, `frontend/e2e/spectator.spec.ts`, `frontend/e2e/sessionLock.spec.ts`, tests.
- **Integration exception:** это integration-задача; до 14 production/E2E файлов предодобрено. Reviewer проверяет, что изменения только про session identity.
- **Шаги:**
  1. Перед созданием Worker для **player** вызвать `ensurePlayerSession()`. В dev URL backend — `http://<host>:8000/session`; в prod — same-origin `/ws/session` (nginx уже проксирует `/ws`). Запрос: `fetch(sessionUrl, {method:'POST', credentials:'include'})`.
  2. Убрать `client_id` из WS URL и `localStorage`; cookie уйдёт автоматически с handshake.
  3. Spectator **не вызывает** `/session`; WS role=spectator, сервер выдаёт новый UUID.
  4. Обработать close-коды: `4002` full — backoff; `4003` role cap — backoff; `1012` restart/drain — retry. Невалидная/отсутствующая cookie — новая identity, не 401; Origin-отказ — HTTP 403 до accept.
  5. Для E2E выставлять наблюдаемый ID: `document.body.dataset.playerId` при `YOUR_ID` (или data-attribute на HUD); переписать три spec, которые сейчас читают `localStorage.snake_client_id`.
  6. Сохранить совместимость с Web Locks/BroadcastChannel takeover.
  7. Очищать cookie при logout/reset, если такой flow есть.
- **Тесты:**
  - Vitest: mock fetch + WebSocket; проверить URL без `client_id`, `credentials: include`, role, close-code handling.
  - E2E: две вкладки, takeover, ID сохраняется; player-спектатор не переиспользует ID.
- **Acceptance:** login/reconnect работают в dev (5173→8000) и prod (same-origin); в URL нет `client_id`; E2E видят стабильный player ID.
- **Out of scope:** backend session store (M1-01/02).

## M1-04 — Reconnect epoch и гонка delayed-remove

- **Priority:** P0
- **Depends:** M1-02
- **Effort:** M
- **Проблема:** `websocket.py:180-198` может удалить уже переподключившегося игрока; `admin_restart_game` может потерять новое соединение.
- **Allowlist:** `backend/app/api/websocket.py`, `backend/app/api/admin.py`, `backend/tests/test_reconnect_race.py` (new), `backend/tests/test_admin_restart.py`, `backend/tests/test_spectator_identity.py`.
- **Шаги:**
  1. Добавить `epoch`/`connection_id` в `active_connections[cid]`; использовать `conn.get("epoch")`, чтобы старые тестовые dict не падали.
  2. `_cleanup_connection` захватывает epoch; `delayed_remove(cid, epoch)` проверяет, что активное соединение всё ещё имеет тот же epoch, и что `active_connections` не содержит нового владельца.
  3. При успешной инициализации отменять pending-disconnect и увеличивать epoch.
  4. Restart: флаг `draining` хранить в `World` (или module-level) и явно сбрасывать при новом старте; новые соединения отклоняются; закрывать и дожидаться задач; pending отменять после закрытия.
  5. Тест: симулировать cleanup → новую сессию → sleep; живой игрок не удалён.
- **Тесты:**
  - `test_delayed_remove_does_not_kill_new_session`
  - `test_restart_does_not_leave_ghost_player`
  - `test_pending_disconnect_cancelled_on_reconnect`
- **Acceptance:** гонка не воспроизводится; restart не оставляет ghost.
- **Out of scope:** session auth (M1-02).

## M1-05 — Origin allowlist, per-IP и role limits + security E2E

- **Priority:** P0
- **Depends:** M1-02, M1-04
- **Effort:** M
- **Проблема:** WS не проверяет `Origin`; `MAX_CONNECTIONS=50` общий; нет per-IP лимита; spectator flood занимает слоты.
- **Allowlist:** `backend/app/api/websocket.py`, `backend/server.py`, `frontend/nginx.conf`, `backend/Dockerfile`, `start_dev.bat`, `frontend/playwright.config.ts`, `frontend/e2e/security.spec.ts` (new), `backend/tests/test_websocket_limits.py` (new).
- **Шаги:**
  1. `ALLOWED_ORIGINS` env; в dev — localhost/127.0.0.1 и LAN-origin из `start_dev.bat`; в prod — явный список.
  2. Проверять `Origin` до `accept()`. Starlette не умеет `close(1008)` до accept — использовать HTTP 403 до accept или `accept()` + `close(1008)`; зафиксировать один вариант и тест.
  3. Per-IP token bucket на handshake; учитывать `X-Real-IP` только от доверенного proxy; включить uvicorn `proxy_headers`/`forwarded_allow_ips` в Docker/start scripts.
  4. Убрать общий `MAX_CONNECTIONS`; хранить `role` в `active_connections` и считать отдельно `MAX_PLAYER_CONNECTIONS`/`MAX_SPECTATOR_CONNECTIONS`.
  5. E2E: другой Origin отклонён; spectator flood получает отказ; player slot не занимается spectator'ом.
- **Тесты:**
  - Backend: `Origin` allow/deny; per-IP limit; role caps.
  - E2E: `security.spec.ts` с двумя контекстами.
- **Acceptance:** cross-origin WS не подключается; flood ограничен; spectator не вытесняет игроков.
- **Out of scope:** CDN/WAF, TLS termination.

---

# M2. Один конфиг

## M2-01 — Rebind `Player.config` при live-update

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** S/M
- **Проблема:** `state.py:200-214` заменяет `self.config`, но `Player.config` остаётся старым (`entities.py:83,128-154`).
- **Allowlist:** `backend/app/engine/state.py`, `backend/app/engine/entities.py`, `backend/tests/test_live_config.py` (new).
- **Шаги:** после `self.config = candidate` пройти по всем players/bots, выставить `p.config = self.config`, затем `align_player_growth`; добавить тест на `head_radius`, `is_accelerating_valid`, respawn с новым `start_length`.
- **Acceptance:** live-изменение `base_head_radius`/`boost.min_score` сразу видно старым игрокам; следующий respawn использует новый `start_length` (текущее тело не перестраивается — это ожидаемо).
- **Out of scope:** Food/BH/Portal derived fields (M2-02).

## M2-02 — `apply_config` для Food/BlackHole/Portal

- **Priority:** P1
- **Depends:** M2-01
- **Effort:** M
- **Проблема:** `Food.radius`, `BlackHole.pull_radius/kill_radius`, `Portal.radius` фиксируются при спавне; `update_slots(force_roll=size_changed)` не обновляет при изменении только радиусов.
- **Allowlist:** `backend/app/engine/food_manager.py`, `backend/app/engine/world_elements/base.py`, `backend/app/engine/world_elements/black_hole.py`, `backend/app/engine/world_elements/portal.py`, `backend/app/engine/state.py`, `backend/tests/test_live_config.py`.
- **Шаги:** добавить `apply_config()` на менеджеры/сущности; пересчитать производные поля без ре-ролла позиций; вызывать из `update_config`; при изменении count/size — существующая логика.
- **Acceptance:** после live-изменения радиусов сервер и клиент используют одинаковые значения; позиции не прыгают без необходимости.
- **Out of scope:** формула (M2-04).

## M2-03 — Валидация: finite, strict int, диапазоны

- **Priority:** P1
- **Depends:** M2-01
- **Effort:** M
- **Проблема:** `_require_range` пропускает NaN; дробные значения для int-полей; нет диапазонов `max_steps_per_tick`/`portals_teleport_delay_ms`.
- **Allowlist:** `backend/game_config.py`, `backend/app/api/config_schema.py`, `backend/app/engine/state.py`, `backend/tests/test_admin_config_schema.py`, `backend/tests/test_config_validation.py` (new).
- **Шаги:** `math.isfinite`; `isinstance(value, int) and not bool` для int; Pydantic `allow_inf_nan=False`; `json.dump(..., allow_nan=False)`; добавить диапазоны; **сначала проверить**, какие дробные int уже режет Pydantic; startup с битым `config.json` должен fail-fast, а не молча брать defaults; тест-матрица NaN/inf/float/negative.
- **Acceptance:** NaN/дробный int/отрицательный шаг не проходят ни через HTTP, ни через `config.json`; битый `config.json` не стартует с тихим fallback.
- **Out of scope:** formula grammar (M2-04).

## M2-04 — Один движок формул роста

- **Priority:** P1
- **Depends:** M2-03
- **Effort:** M
- **Проблема:** AST-валидатор (`game_config.py:324-447`) и runtime `FormulaParser` (`formula_parser.py:9-163`) расходятся: `**` токенизируется в два `*`, `%` отсутствует в regex, ошибки молча дают `10.0`. `^` уже отвергается AST-валидатором (BitXor), это не главная проблема.
- **Allowlist:** `backend/game_config.py`, `backend/app/engine/systems/formula_parser.py`, `backend/app/engine/state.py`, `backend/tests/test_formula_parser.py`, `backend/tests/test_growth.py`.
- **Шаги:** один compile/eval на AST с кэшем; поддержать `+ - * / % **`; убрать silent fallback; validation и runtime используют один код; differential-таблица на точках/операторах/делении на 0/NaN.
- **Acceptance:** любая формула, прошедшая validation, даёт тот же результат в runtime; differential-тест ловит divergence на `**`, `%`, делении на 0.
- **Out of scope:** UI-редактор формул.

## M2-05 — Транзакционное сохранение конфига

- **Priority:** P1
- **Depends:** M2-03
- **Effort:** M
- **Проблема:** `update_config` сохраняет на диск до применения; ошибка apply оставляет диск и память рассинхронизированными.
- **Allowlist:** `backend/app/engine/state.py`, `backend/app/api/admin.py`, `backend/tests/test_config_persistence.py`.
- **Шаги:** backup предыдущего файла; применить в память в try/except; при ошибке восстановить старый config и перезаписать диск; вернуть 503; fsync каталога с platform guard (Windows); тест с monkeypatched failure.
- **Acceptance:** сбой live-apply не оставляет «полуконфиг»; backup и понятная ошибка; rollback явно ограничен config/players и не пытается откатить уже перестроенные grid/food/portal/BH, если это невозможно — тест фиксирует это поведение.
- **Evidence:** monkeypatch failure → 503, файл на диске равен backup, live-config равен старому.
- **Out of scope:** Docker volume (M5-04).

---

# M3. Корректный netcode

## M3-01 — События на границе тика

- **Priority:** P0/P1
- **Depends:** M1-04
- **Effort:** M
- **Проблема:** `game.py:16-17` очищает `kill_events`; `food_manager.tick_start` очищает `new_foods`; `remove_player` вне тика теряет drop/kill.
- **Allowlist:** `backend/app/engine/game.py`, `backend/app/engine/state.py`, `backend/app/engine/food_manager.py`, `backend/app/api/websocket.py`, `backend/tests/test_tick_events.py` (new), `backend/tests/test_world_lifecycle.py`.
- **Шаги:** единая очередь `pending_removals`; `_cleanup_connection` только enqueue-ит, tick обрабатывает её в начале после очистки событий; `reset_state` очищает очередь; `remove_player(emit_death=False)` для failed handshake; тест «disconnect между тиками → food виден в следующем DELTA/killfeed».
- **Acceptance:** смерть между тиками не теряет еду и killfeed; нет второго пути удаления; reset_state не оставляет pending.
- **Out of scope:** protocol seq.

## M3-02 — Backpressure: статус очереди и cleanup sender

- **Priority:** P1
- **Depends:** M3-01
- **Effort:** M
- **Проблема:** при полной очереди с FULL новый DELTA отбрасывается без `needs_full_sync`; sender failure оставляет соединение.
- **Allowlist:** `backend/app/api/websocket.py`, `backend/server.py`, `backend/tests/test_websocket_queue.py` (new).
- **Шаги:** `FrameQueue`/enum status; при dropped DELTA — `needs_full_sync=True`, но **coalesce**, если FULL уже в очереди (не FULL-шторм); sender exception → close/cleanup; убрать `queue._queue`; тест медленного клиента: FULL → delta chain без gap и без лавины FULL.
- **Acceptance:** потеря DELTA восстанавливается FULL; медленный клиент не вызывает full-шторм; мёртвый sender не занимает слот.
- **Out of scope:** seq/resync.

## M3-03 — Body/new_heads: truth table, `body_truncated`, DeltaDecoder

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** `length=1` одновременно значит «вне AoI» и «реальная змейка из одного сегмента»; `DeltaDecoder.getNewBody` возвращает `[]` для нового far-player; `length=0` оставляет ghost; DELTA-parity не сравнивает координаты `new_heads`.
- **Allowlist:** `tests_shared/snake.proto`, `backend/app/engine/systems/serialization.py`, `frontend/src/worker/shared/ProtoFrameDecoder.ts`, `frontend/src/worker/DeltaDecoder.ts`, `frontend/src/worker/DeltaDecoder.parity.test.ts`, `backend/tests/test_frame_parity.py`, `tests_shared/golden_frames/*`.
- **Truth table (зафиксировать в коде и docs):**

  | Состояние | `body` | `length` | `final_length` | `body_truncated` |
  |---|---|---|---|---|
  | alive, in AoI | full body, head first | `body_len` | unset | `false` |
  | alive, out of AoI | empty / mini | `1` | unset | `true` |
  | dead | empty | `0` | set (M3-04) | `false` |

- **Шаги:**
  1. Добавить `optional bool body_truncated = 17` в Player (16 зарезервирован под `final_length` в M3-04).
  2. Backend выставляет `length=1` + `body_truncated=true` для out-of-AoI; `length=0` + пустое body для dead; full body — `false`.
  3. `ProtoFrameDecoder` читает поле; `DeltaDecoder.getNewBody`: dead/length=0 → `[]`; `body_truncated` → `[]` (миникарта берёт `head_x/head_y`); in-AoI без old body + `new_heads` → голова; `length=1` без флага — реальная змейка.
  4. Добавить точные DELTA-координаты `new_heads` в parity-тест и тест «голова первая».
  5. Перегенерировать golden; review diff.
- **Acceptance:** dead не оставляет ghost; far-player не рендерится как одноточечная змея; реальная длина 1 работает; координаты совпадают с сервером.
- **Out of scope:** `final_length` (M3-04).

## M3-04 — `final_length` end-to-end

- **Priority:** P1
- **Depends:** M3-03
- **Effort:** M
- **Проблема:** `final_length` не сериализуется; экран смерти показывает 0.
- **Allowlist:** `tests_shared/snake.proto`, `backend/app/engine/systems/serialization.py`, `frontend/src/worker/shared/ProtoFrameDecoder.ts`, `frontend/src/worker/DeltaDecoder.ts`, `frontend/src/types/game.ts`, `frontend/src/ui/react/GameOverScreen.test.tsx`, `backend/tests/generate_frame_fixtures.py`, `tests_shared/golden_frames/*`, tests.
- **Шаги:** `optional int32 final_length = 16` в Player; set только для dead; decode; fallback `is_dead` → game-over; regenerate golden. `FrameComputer.ts` уже читает `final_length` — менять его не нужно, только тип.
- **Acceptance:** на экране смерти реальная длина (React-тест + E2E); живые golden не деградировали.
- **Out of scope:** `body_truncated` (M3-03).

## M3-05 — `frame_seq`/`server_tick` backend

- **Priority:** P1
- **Depends:** M3-04
- **Effort:** M
- **Проблема:** нет способа обнаружить пропуск/битый кадр.
- **Allowlist:** `tests_shared/snake.proto`, `backend/app/engine/state.py` (counter), `backend/app/engine/systems/serialization.py`, `backend/server.py`, `backend/app/api/websocket.py`, `frontend/src/worker/shared/ProtoFrameDecoder.ts`, golden, tests.
- **Шаги:**
  1. `optional uint32 frame_seq = 19`, `optional uint32 server_tick = 20` в `GameStateFrame` (не в Player; не путать с `server_tick_rate=2`).
  2. `frame_seq` — **один на тик**, общий для всех клиентов; `process_client` только проставляет уже вычисленный seq. Не инкрементировать на каждого клиента.
  3. Set во всех FULL/DELTA; restart сбрасывает; FULL/reconnect сбрасывают клиентский `lastSeq`.
  4. `RESYNC` в receive loop: `needs_full_sync=True`, cooldown (например, не чаще 1/сек), отбрасывать накопленные DELTA; тест на спам RESYNC.
  5. Regenerate golden; review diff.
- **Acceptance:** seq монотонный и одинаковый для всех клиентов в тике; `RESYNC` включает FULL; спам RESYNC не даёт FULL-шторм; golden обновлены осознанно.
- **Out of scope:** frontend gap detection (M3-06).

## M3-06 — Frontend seq/resync

- **Priority:** P1
- **Depends:** M3-05
- **Effort:** M
- **Проблема:** decode error/gap не инициирует FULL.
- **Allowlist:** `frontend/src/worker/WebSocketClient.ts`, `frontend/src/worker/worker.ts`, `frontend/src/worker/DeltaDecoder.ts`, tests.
- **Шаги:** track last seq (сброс на FULL/reconnect); gap или decode error → отправить `RESYNC`, очистить/не применять; unknown type игнорировать; cooldown на RESYNC; использовать серверный `RESYNC` из M3-05; тесты.
- **Acceptance:** после искусственного gap клиент получает FULL и восстанавливается; повторный gap не спамит RESYNC.
- **Out of scope:** server queue (M3-02).

## M3-07 — Empty frame, requestId, camera guard

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** пустой `FRAME_DATA` без camX/camY даёт NaN; stale-check сравнивает `performance.now()` из двух realm, поэтому не работает.
- **Allowlist:** `frontend/src/game/NetworkManager.ts`, `frontend/src/worker/worker.ts`, `frontend/src/game/Game.ts`, `frontend/src/game/RenderOrchestrator.ts`, `frontend/src/game/Camera.ts`, tests.
- **Шаги:** `FRAME_UNAVAILABLE` + requestId; main игнорирует stale/не применяет пустой кадр; `Number.isFinite` guard; убрать сравнение `performance.now()` между main/worker, worker timeout — на своей стороне.
- **Acceptance:** нет NaN-камеры; stale-кадры не применяются.
- **Out of scope:** typed protocol (M4-04).

## M3-08 — `gridToWorld` и смещение порталов/ЧД

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** порталы/ЧД используют `grid*gridSize`, игрок/еда/камера — `+gridSize/2`; смещение 10 world units. D4 требует единый helper для всех.
- **Allowlist:** `frontend/src/worker/shared/WorldMath.ts` (new), `frontend/src/worker/FoodComputer.ts`, `frontend/src/worker/PortalComputer.ts`, `frontend/src/worker/BlackHoleComputer.ts`, `frontend/src/worker/SnakeProcessor.ts`, `frontend/src/worker/FrameComputer.ts`, `frontend/src/worker/SplineComputer.ts`, `frontend/src/worker/CameraPredictor.ts`, `frontend/src/ui/Minimap.ts`, `frontend/src/renderer/PostProcessing.ts`, `frontend/src/renderer/SnakeRenderer.ts`, tests.
- **Size exception:** mechanical adoption, до 12 production файлов предодобрено; reviewer проверяет behavior-preserving.
- **Шаги:** helper `gridToWorldX(x) = x*gridSize + gridSize/2`, `gridToWorldY(y) = -(y*gridSize + gridSize/2)`, `worldToGrid`; заменить все прямые `grid*gridSize`/`+gridSize/2`; тест на известные точки/шов; ручная визуальная проверка портала/ЧД (Evidence: координаты/скриншот).
- **Acceptance:** визуальная зона ЧД совпадает с collision; портал не смещён на полклетки; ни в одном call site не осталось локального `+gridSize/2`.
- **Out of scope:** torus helper (M3-09).

## M3-09 — Централизация torus-математики

- **Priority:** P1
- **Depends:** M3-08
- **Effort:** M
- **Проблема:** wrap-формулы продублированы в 8+ местах.
- **Allowlist:** `frontend/src/worker/shared/MathUtils.ts`, `frontend/src/worker/FoodComputer.ts`, `frontend/src/worker/PortalComputer.ts`, `frontend/src/worker/BlackHoleComputer.ts`, `frontend/src/worker/CameraPredictor.ts`, `frontend/src/worker/SnakeProcessor.ts`, `frontend/src/ui/Minimap.ts`, `frontend/src/renderer/DecorField.ts`, `frontend/src/game/spectatorCameraMath.ts`, `backend/app/engine/systems/math_utils.py`, `tests_shared/golden_vectors/math.json`, `backend/tests/test_math_parity.py`, tests.
- **Size exception:** mechanical adoption, до 12 production файлов предодобрено.
- **Шаги:** добавить `wrapNearest`/`toroidalDelta`/`toroidalDistance`; заменить inline; tie-case на ровно `w/2`; если меняется семантика — синхронно обновить Python и golden vectors; тесты на seam.
- **Acceptance:** один источник; TS и Python parity на golden vectors; поведение не меняется, кроме исправленных багов; tie-case покрыт.
- **Out of scope:** gridToWorld (M3-08).

## M3-10 — Один writer FULL-кадра + initial FULL offload

- **Priority:** P1
- **Depends:** M3-05
- **Effort:** M
- **Проблема:** full-frame собирается в `server.py` и `serialization.py`; initial FULL синхронный.
- **Allowlist:** `backend/server.py`, `backend/app/engine/systems/serialization.py`, `backend/app/api/websocket.py`, `backend/tests/test_frame_parity.py`, `backend/tests/test_late_join.py` (new).
- **Шаги:** один `build_full_frame`; `process_client` использует его; initial FULL: snapshot строится **в event loop**, в `asyncio.to_thread` уходит только `zlib.compress(..., level=1)`; parity late-join. Если golden меняются — stop и отдельная задача.
- **Acceptance:** initial FULL и resync FULL эквивалентны по содержимому (`your_id`, foods); event loop не блокируется на compress; golden не изменились без отдельного решения.
- **Evidence:** тест сравнения uncompressed кадров + замер handshake на большом `target_food_count`.
- **Out of scope:** caching base frame.

## M3-11 — Расширение golden-фикстур

- **Priority:** P1
- **Depends:** M3-03, M3-04, M3-05, M3-10, M3-12
- **Effort:** M
- **Проблема:** фикстуры покрывают один happy-path; byte-golden зависит от zlib; golden регенерируются несколько раз в M3-04/M3-05/M3-12.
- **Allowlist:** `backend/tests/frame_scenario.py`, `backend/tests/generate_frame_fixtures.py`, `backend/tests/test_frame_parity.py`, `tests_shared/golden_frames/*`, `frontend/src/worker/DeltaDecoder.parity.test.ts`.
- **Sequence note:** M3-12 (spawn wrap) выполняется **до** M3-11, чтобы финальная регенерация golden была одна.
- **Шаги:** дождаться M3-03/04/05/10/12 и сделать **одну** финальную регенерацию golden; сценарии death/teleport/AoI transition/empty; сравнивать uncompressed protobuf; `.bin` оставить для decoder round-trip; pinned config.
- **Acceptance:** новые сценарии ловят порядок body/new_heads, body_truncated, final_length, seq; golden регенерированы один раз и diff review.
- **Out of scope:** новые поля протокола.

## M3-12 — Заворачивать стартовое тело у края карты

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** S
- **Проблема:** `Player.respawn` строит `start_x - i`; при `start_x=5` и `start_length=9` первые сегменты отрицательные (`entities.py:99-104`). `frame_scenario._set_player_pos` уже содержит такие координаты в golden.
- **Allowlist:** `backend/app/engine/entities.py`, `backend/app/engine/food_manager.py` (если нужен margin), `backend/tests/frame_scenario.py`, `backend/tests/test_spawn.py` (new), `tests_shared/golden_frames/*`.
- **Шаги:** выбрать один вариант (рекомендуется wrap каждого сегмента по `grid_width`); обновить `_set_player_pos` тем же правилом; тест на `x=5`, `start_length=9`, map shrink; перегенерировать golden.
- **Acceptance:** в теле нет координат вне `[0, width)`; golden обновлены осознанно; клиент не рисует сегменты за швом.
- **Out of scope:** изменение `physics` wrap.

## M3-13 — Killfeed: `tombstone` vs `tomb_*`

- **Priority:** P2
- **Depends:** M0-02
- **Effort:** S
- **Проблема:** backend пишет killer `"tombstone"` (`spatial_index.py:25`), frontend локализует только `killer.startsWith("tomb_")` (`KillFeed.tsx:6-14`).
- **Allowlist:** `frontend/src/ui/react/KillFeed.tsx`, `frontend/src/ui/react/GameHud.test.tsx`, `backend/app/engine/systems/spatial_index.py` (если решено менять backend).
- **Шаги:** выбрать один контракт (рекомендуется `killer: "tombstone"` + UI special-case) и покрыть тестом реальный литерал.
- **Acceptance:** смерть от надгробия показывает локализованное «Надгробие», не сырой id.
- **Out of scope:** переименование tombstones.

---

# M4. Устойчивый frontend

## M4-01 — Input ownership: resync, focus, HUD

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** после respawn/reconnect input залипает; capture-перехват ломает UI; mousemove над HUD рулит.
- **Allowlist:** `frontend/src/game/Game.ts`, `frontend/src/game/InputManager.ts`, `frontend/src/ui/react/SettingsPanel.tsx`, `frontend/src/ui/MobileControls.ts`, `frontend/src/game/bootstrap.ts`, tests.
- **Шаги:** `resyncInput()` на respawn/reconnect сбрасывает и `InputManager`, и `Game.throttledTurn`/`lastAccelerating`, затем отправляет полный snapshot; не перехватывать INPUT/TEXTAREA/SELECT/BUTTON/contenteditable; `preventDefault` после guard; `isUiOpen`/`closest('.hud-interactive')`; тесты.
- **Acceptance:** Escape/Space/стрелки работают в UI; после respawn/reconnect удержание Space/стрелки сразу действует.
- **Evidence:** Vitest на capture/focus + ручной чек-лист «открыть настройки, нажать Escape/Space/стрелки».
- **Out of scope:** WebGL.

## M4-02 — WebGL context loss/recovery

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** нет `webglcontextlost/restored`; после GPU reset чёрный экран.
- **Allowlist:** `frontend/src/renderer/SceneManager.ts`, `frontend/src/game/Game.ts`, `frontend/src/game/RenderOrchestrator.ts`, `frontend/src/ui/react/GameErrorOverlay.tsx` (new), `frontend/src/styles/*.css`, `frontend/e2e/webgl.spec.ts` (new).
- **Шаги:** v1 — listeners, pause rAF, показать overlay с reload; не пытаться в этой задаче полностью пересобрать composer/materials. Rebuild — отдельная M6-задача. Playwright `WEBGL_lose_context`.
- **Acceptance:** context loss не оставляет молчаливый чёрный экран; пользователь видит статус и может reload.
- **Evidence:** Playwright trace/screenshot с overlay.
- **Out of scope:** полный rebuild GPU-ресурсов (M6), worker watchdog (M4-03).

## M4-03 — Worker watchdog и bootstrap error screen

- **Priority:** P1
- **Depends:** M4-02
- **Effort:** M
- **Проблема:** нет `worker.onerror`; bootstrap снимает login до старта; нет WebGL2 fallback.
- **Allowlist:** `frontend/src/game/NetworkManager.ts`, `frontend/src/game/bootstrap.ts`, `frontend/src/game/Game.ts`, `frontend/src/worker/worker.ts`, `frontend/src/ui/react/GameErrorOverlay.tsx`, `frontend/src/ui/react/mountGameErrorOverlay.tsx` (new), `frontend/src/lib/i18n.ts`, `frontend/src/main.ts`, tests.
- **Шаги:** onerror/onmessageerror; stall counter; recreate worker с backoff; при recreate заново поднимать сессию и сбрасывать `myId`; error screen через mount; WebGL2/worker check до старта.
- **Acceptance:** падение worker не выглядит как зависшая игра; ошибка инициализации видна; после recreate нет старого `myId`.
- **Evidence:** unit на state machine + ручной/Playwright сценарий с убитым worker.
- **Out of scope:** typed protocol.

## M4-04 — Типизированный worker protocol и FrameContext

- **Priority:** P1
- **Depends:** M3-07
- **Effort:** L
- **Проблема:** 19–20 позиционных аргументов, `any` на границе main↔worker.
- **Allowlist:** `frontend/src/worker/shared/WorkerProtocol.ts` (new), `frontend/src/game/NetworkManager.ts`, `frontend/src/worker/WebSocketClient.ts`, `frontend/src/worker/worker.ts`, `frontend/src/worker/FrameComputer.ts`, `frontend/src/worker/SnakeProcessor.ts`, `frontend/src/game/RenderOrchestrator.ts`, `frontend/src/game/Game.ts`, `frontend/src/game/Camera.ts`, tests/typecheck.
- **Шаги:** разделить wire protocol (`MainToWorker`/`WorkerToMain`, включая `FRAME_UNAVAILABLE`) и `FrameContext`/`SnakeContext`; заменить позиционные аргументы; layout массивов не менять; добавить E2E-смоук login→frame.
- **Acceptance:** `tsc --noEmit` ловит несовпадения; E2E-смоук проходит; поведение не меняется.
- **Evidence:** typecheck + E2E trace.
- **Out of scope:** runtime-валидатор (отдельная задача).

## M4-05 — SnakeRenderer update ranges

- **Priority:** P1
- **Depends:** M0-02
- **Effort:** S
- **Проблема:** каждый кадр на GPU уходят полные 500k-буферы.
- **Allowlist:** `frontend/src/renderer/SnakeRenderer.ts`, `frontend/src/renderer/SnakeRenderer*.test.ts`, tests.
- **Шаги:** считать used length; `clearUpdateRanges`/`addUpdateRange`; `needsUpdate`; test spy; проверить `renderer.info`.
- **Acceptance:** обновляется только использованный диапазон; визуал не меняется.
- **Evidence:** unit spy на `addUpdateRange` + `renderer.info` до/после.
- **Out of scope:** аллокации Spline/Food.

---

# M5. Эксплуатация и docs

## M5-01 — Health/readiness и tick-метрики

- **Priority:** P1
- **Depends:** M0-01
- **Effort:** M
- **Проблема:** `/health` всегда ok; нет heartbeat тика.
- **Allowlist:** `backend/server.py`, `backend/app/api/admin.py`, `backend/app/engine/state.py`, `backend/Dockerfile`, `frontend/nginx.conf`, `frontend/Dockerfile`, tests.
- **Шаги:** `last_tick_monotonic`, `tick_count`, `tick_duration_ms`, `tick_errors`; **liveness** (`/ws/health` — процесс жив) отдельно от **readiness** (`/ws/ready` — tick свежий); `/ws/ready` 503 при stale tick; frontend nginx healthcheck — локальный liveness, не проксированный backend; не рестартовать игровой контейнер из-за короткого stale tick, только сигналить.
- **Acceptance:** зависший tick виден в `/ws/ready`; liveness не зависит от игры; healthcheck не убивает in-memory игру при коротком ступоре.
- **Evidence:** `curl` 200/503 для health/ready + лог.
- **Out of scope:** Prometheus/Sentry.

## M5-02 — Admin audit, XFF, limiter bounds

- **Priority:** P1
- **Depends:** M1-05
- **Effort:** S/M
- **Проблема:** spoofable XFF; неограниченный `_login_attempts`; нет audit-лога.
- **Allowlist:** `backend/app/api/admin.py`, `frontend/nginx.conf`, tests.
- **Шаги:** использовать `X-Real-IP` от trusted proxy; bounded/TTL limiter; audit login/config/restart в JSON-лог (timestamp, event, ip, keys, result), не логировать секреты.
- **Acceptance:** spoofed XFF не обходит лимит; audit-запись проверяется grep/тестом.
- **Evidence:** тест на spoofed XFF + пример audit-строки.
- **Out of scope:** 2FA.

## M5-03 — Docker/nginx hardening

- **Priority:** P1
- **Depends:** M5-01
- **Effort:** M
- **Проблема:** frontend nginx root; mutable tags; нет log rotation; graceful shutdown.
- **Allowlist:** `frontend/Dockerfile`, `backend/Dockerfile`, `docker-compose.yml`, `frontend/nginx.conf`, `.dockerignore`, `.github/workflows/ci.yml`.
- **Шаги:** unprivileged nginx с writable dirs (temp/cache/pid); digest pin base images; `logging` limits; проверить/скорректировать уже существующий `stop_grace_period`; `--timeout-graceful-shutdown`; healthchecks.
- **Acceptance:** `docker compose config`/build/up; `id` в frontend-контейнере не root; logs ограничены.
- **Evidence:** `docker compose config`, `docker run ... id`, `docker stats`/log config.
- **Out of scope:** CD.

## M5-04 — Config deployment, backup, versioning

- **Priority:** P1
- **Depends:** M2-05
- **Effort:** M/L
- **Проблема:** runtime `backend/config.json` трекается и монтируется bind-mount; non-root может не писать; нет backup.
- **Allowlist:** `backend/Dockerfile`, `docker-compose.yml`, entrypoint (new), `backend/config.example.json` (new), `.gitignore`, `backend/app/engine/state.py`, `frontend/playwright.config.ts`, `README.md`, docs.
- **Шаги:** `git rm --cached backend/config.json`; named volume; seed из example при пустом volume; ownership для non-root `appuser`; backup/restore; schema version/migration note; обновить Playwright copy и README.
- **Acceptance:** fresh named volume → контейнер стартует и пишет config; `git pull` не перезаписывает live; E2E и README используют example/temp; backup есть.
- **Evidence:** `docker compose down -v && up`, PATCH config, `cat` файла, backup-файл.
- **Out of scope:** full migration framework.

## M5-05 — Dead code removal

- **Priority:** P2
- **Depends:** M0-02
- **Effort:** M
- **Проблема:** мёртвые скрипты, `Player.to_dict`/`_cached_*`, неиспользуемые i18n/CSS.
- **Allowlist:** `backend/append_systems.py`, `backend/test_ws.py`, `backend/test_serialize.py`, `analyze.py`, `backend/app/engine/entities.py`, `backend/app/engine/systems/serialization.py`, `frontend/src/lib/i18n.ts`, `frontend/src/styles/admin.css`, `frontend/src/worker/shared/MathUtils.ts`, tests.
- **Шаги:** удалить `append_systems.py`, `test_ws.py`, `test_serialize.py`, `analyze.py`; удалить `Player.to_dict` и `Player._cached_*`/`clear_cache`, если они не используются; **не трогать** живые `World.full_players_cache`/`mini_players_cache`; убрать неиспользуемые i18n-ключи/CSS.
- **Acceptance:** мёртвый код удалён; `pytest`/`vitest` зелёные; нет ссылок на удалённые символы.
- **Evidence:** `git grep` по удалённым именам + полный targeted suite.
- **Out of scope:** docs, code refactors.

## M5-06 — Синхронизация документации

- **Priority:** P2
- **Depends:** M5-04
- **Effort:** M
- **Проблема:** docs drift; `GAME_STATE` превратился в changelog; карта не содержит новые файлы.
- **Allowlist:** `PROJECT_MAP.md`, `ARCHITECTURE.md`, `GAME_STATE.md`, `docs/HISTORY.md` (new), `README.md`.
- **Шаги:** split `GAME_STATE` на текущий статус + `docs/HISTORY.md`; обновить карту/архитектуру под M1–M5; проверить ссылки на файлы/тесты; убрать хардкод количества тестов.
- **Acceptance:** docs соответствуют коду; все ссылки живые; `PROJECT_MAP` содержит новые файлы.
- **Evidence:** link-check скрипт/`git grep` по путям + diff review.
- **Out of scope:** code changes, runbook/security.

## M5-07 — RUNBOOK, SECURITY, ADRs

- **Priority:** P2
- **Depends:** M5-06
- **Effort:** M
- **Проблема:** нет инструкций по инцидентам, раскрытию уязвимостей и зафиксированных решений.
- **Allowlist:** `RUNBOOK.md` (new), `SECURITY.md` (new), `docs/adr/*` (new), `PROJECT_MAP.md`.
- **Шаги:** runbook deploy/rollback/health triage/config restore/OOM/WS saturation/TLS; security policy + threat model; ADR-001 session auth, ADR-002 frame sequencing, ADR-003 config ownership, ADR-004 grid/world, ADR-005 tick events.
- **Acceptance:** runbook проверен на одном учебном инциденте (запись/артефакт); ADR соответствуют D1–D5.
- **Evidence:** drill log + ADR links.
- **Out of scope:** code changes.

---

# M6. Optional backlog (после production hardening)

Эти задачи важны, но не блокируют безопасный запуск. Запускать только по отдельному решению.

| ID | Задача | Зачем | Effort |
|---|---|---|---|
| M6-01 | Hot-path allocations: `SplineComputer`/`FoodComputer` scratch buffers | GC-паузы | L |
| M6-02 | Minimap throttle 10–15 Hz + food caps + legacy heuristic removal | main-thread нагрузка | S/M |
| M6-03 | Lazy-load `Game`/Three on Play + vendor chunk | first paint | S/M |
| M6-04 | UI a11y: focus trap, `role=dialog`, `aria-live`, mobile spectator, safeStorage | UX/доступность | M |
| M6-05 | Admin UI hardening: `isSaving`, typed `SaveResult`, defaults, image path allowlist | админ-надёжность | M |
| M6-06 | CD: GHCR, release tags, compose smoke, rollback | эксплуатация | L |
| M6-07 | E2E expansion: reconnect, context loss, admin save/restart, mobile | регрессии | M |
| M6-08 | Split `World` → `ConfigStore`/`InputRouter`/`SnapshotService` | сопровождаемость | L |
| M6-09 | Split `SceneManager` → lighting/fog/ground/pipeline | сопровождаемость | L |
| M6-10 | Prediction + reconciliation или официально server-authoritative follower | latency | L |
| M6-11 | SSAO: включить или удалить мёртвый флаг/пресеты | честность настроек | S |
| M6-12 | Adaptive resolution по GPU time, а не FPS | качество auto | M |
| M6-13 | WebGL: полный rebuild composer/targets/materials после context restore | восстановление без reload | M/L |

---

## 4. Gates

### Gate 0 — после M0

- CI зелёный, backend/E2E реально выполняются.
- `pytest` не зависит от `backend/config.json`.
- `git diff` содержит только CI/tests.

### Gate 1 — после M1

- Hijack-тест: чужой `client_id` без cookie не захватывает игрока.
- Reconnect сохраняет змейку; delayed-remove не убивает новую сессию.
- Cross-origin WS отклонён; per-IP/role limits работают.
- E2E security suite зелёный 3 прогона подряд.

### Gate 2 — после M2

- Live-update `head_radius`/`boost`/`start_length` применяется к старым игрокам.
- Food/BH/Portal радиусы обновляются без ре-ролла.
- NaN/float-int/negative не проходят validation.
- Любая валидная формула даёт тот же результат в runtime.
- Сбой apply не оставляет рассинхрон disk/memory.

### Gate 3 — после M3

- Disconnect между тиками не теряет food/killfeed.
- Потеря DELTA всегда приводит к FULL.
- `final_length` доходит до экрана смерти.
- seq gap/decode error → RESYNC → восстановление.
- Портал/ЧД визуально совпадают с collision; torus-хелперы централизованы.
- Стартовое тело не выходит за границы; killfeed локализует надгробие.
- Golden-фикстуры покрывают death/teleport/AoI.
- Полный `run_checks.py all` + E2E.

### Gate 4 — после M4

- После respawn/reconnect управление не залипает; UI не рулит змейкой.
- Context loss/worker crash дают понятный статус и recovery/reload.
- Worker protocol типизирован; `tsc` ловит несовпадения.
- GPU обновляет только used ranges.

### Gate 5 — после M5

- `/health` 503 при stale tick; `/ready` работает.
- Config пишется non-root контейнером; backup/restore проверены.
- Docker/nginx hardening; logs ограничены.
- Dead code удалён; docs синхронизированы; runbook/security/ADR на месте.
- `/ws/health` liveness и `/ws/ready` readiness проверены; config пишется на fresh volume.
- Полный CI + E2E + smoke.

---

## 5. Risk register

| Риск | Вероятность | Влияние | Митигация |
|---|---|---|---|
| Session auth ломает reconnect/старых клиентов | Средняя | Высокое | Cookie + fallback new identity; E2E two-tab; staged deploy |
| Protocol changes ломают golden/старых клиентов | Средняя | Высокое | Только additive optional; regenerate + review; versioned fixtures |
| Config fix меняет баланс/поведение | Средняя | Среднее | Тесты на старые значения; live-update тест; manual smoke |
| Coordinate fix меняет визуал | Высокая | Среднее | Unit-тесты + ручная проверка портала/ЧД |
| Refactor задевает скрытые связи | Средняя | Высокое | One task = one concern; allowlist; reviewer; phase gates |
| CI снова красный и маскирует регрессии | Средняя | Высокое | Gate 0; branch protection; run checks before each task |
| Test isolation выявляет скрытые глобалы | Высокая | Низкое/среднее | Отдельная задача M0-02; фиксировать, не «подгонять» тесты |
| Ops changes блокируют админку | Средняя | Высокое | Backup/rollback; smoke; runbook |
| Субагент «расползается» по scope | Высокая | Высокое | Stop-conditions; allowlist; diff review; max 8 files |

---

## 6. Что явно не делаем в этом плане

- Не переписываем игровое ядро на ООП/ECS.
- Не меняем формат `body`/`new_heads` без отдельного решения и versioned fixtures.
- Не добавляем аккаунты/OAuth/2FA.
- Не делаем Kubernetes/микросервисы.
- Не оптимизируем шейдеры/визуал без профилирования.
- Не делаем полный редизайн UI.
- Не добавляем runtime-зависимости без согласования.

---

## 7. Первый запуск после одобрения

1. `M0-01` — CI repair.
2. `M0-02` — test isolation.
3. Gate 0.
4. `M1-01` — backend session store.
5. `M1-02` — WS auth.
6. `M1-03` — frontend session plumbing.
7. `M1-04` — reconnect epoch.
8. `M1-05` — Origin/limits + security E2E.
9. Gate 1.

До Gate 1 не трогаем config/netcode/frontend performance, чтобы не смешивать причины
регрессий и не строить новые слои на нестабильной identity.

---

## 8. Traceability: находка аудита → задача

Исходные пять отчётов — артефакты сессии; эта матрица — durable-след для ревью и приёмки.
Она не заменяет полные отчёты, но фиксирует, что каждая крупная находка получила задачу
или осознанно отложена.

| Находка | Задача |
|---|---|
| CI red, несуществующий `setup-uv@v9` | M0-01 |
| Тесты зависят от runtime `config.json`; zlib-byte golden | M0-02, M3-11 |
| Публичный `client_id` = credential; hijack | M1-01, M1-02, M1-03 |
| Reconnect delayed-remove убивает новую сессию | M1-04 |
| WS без Origin/per-IP; spectator flood | M1-05 |
| `Player.config` stale после live-update | M2-01 |
| Food/BH/Portal радиусы зафиксированы при спавне | M2-02 |
| NaN/дробные int/отсутствующие диапазоны | M2-03 |
| AST-валидатор ≠ runtime formula parser | M2-04 |
| Save-before-apply, нет rollback/backup | M2-05 |
| `kill_events`/`new_foods` теряются на границе тика | M3-01 |
| Full+DELTA backpressure, sender leak | M3-02 |
| `length=1`/dead/new-far body semantics | M3-03 |
| `final_length` не сериализуется | M3-04 |
| Нет seq/ack/RESYNC | M3-05, M3-06 |
| Empty frame → NaN camera; cross-realm time | M3-07 |
| Portal/BH half-cell offset | M3-08 |
| Torus wrap продублирован 8+ раз | M3-09 |
| FULL frame собран дважды; initial FULL sync | M3-10 |
| Golden не покрывают death/teleport/AoI | M3-11 |
| `Player.respawn` negative body у края | M3-12 |
| `tombstone` не локализуется | M3-13 |
| Input залипает; capture ломает UI | M4-01 |
| Нет WebGL context loss recovery | M4-02 |
| Нет worker watchdog/bootstrap error | M4-03 |
| 19–20 positional args; `any` frame | M4-04 |
| SnakeRenderer full-buffer upload | M4-05 |
| `/health` константа; нет tick heartbeat | M5-01 |
| XFF spoof, limiter growth, нет audit | M5-02 |
| Root nginx, mutable images, log growth | M5-03 |
| Runtime config tracked/bind-mount | M5-04 |
| Мёртвый код | M5-05 |
| Docs drift / GAME_STATE changelog | M5-06 |
| Нет runbook/security/ADR | M5-07 |
| Аллокации кадра, minimap, lazy load, a11y, admin UI, CD, god objects, prediction, SSAO, adaptive resolution | M6 optional |

**Отложено осознанно:** полный переход на ООП/ECS, аккаунты/OAuth/2FA, Kubernetes, редизайн UI, переписывание шейдеров без профилирования. Это не «забытые» находки, а решения вне scope текущего remediation.
