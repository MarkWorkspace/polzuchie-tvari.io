# RUNBOOK: Polzuchie-tvari.io

> ROLE: Эксплуатационный runbook для docker-compose-развёртывания: deploy,
> rollback, health triage, восстановление конфига, OOM/CPU, WebSocket и TLS.
> Не заменяет код и не является журналом реального инцидента.

Срез проверен по `docker-compose.yml`, `backend/Dockerfile`,
`frontend/nginx.conf`, маршрутам `backend/server.py` и `backend/app/api/*.py`
на 2026-11-02. Учебный drill в конце — **tabletop**, а не production incident;
он не содержит выдуманных production-логов, времени или метрик.

Связанные документы:

- [`SECURITY.md`](SECURITY.md) — политика раскрытия уязвимостей и threat model.
- [`docs/adr/README.md`](docs/adr/README.md) — принятые архитектурные решения.
- [`README.md`](README.md) — quickstart, проверки и Docker.
- [`PROJECT_MAP.md`](PROJECT_MAP.md) — карта файлов.

## 1. Быстрые факты

| Проверка | Endpoint | Что означает |
|---|---|---|
| Liveness backend | `GET /health`, `GET /ws/health` | Процесс отвечает; всегда `200 {"status":"ok"}` и не зависит от игрового цикла. |
| Readiness backend | `GET /ready`, `GET /ws/ready` | Игровой цикл тикает; `200` при свежем heartbeat, `503` при stale tick. Отдаёт `tick_age_ms`, `tick_count`, `tick_duration_ms`, `tick_errors`. |
| Liveness frontend | `GET :3000/health` | Локальный ответ nginx `200 ok`; **не** проверяет backend и игру. |
| Админ-метрики | `GET :8000/admin/health` или `/ws/admin/health` через frontend | Требует admin-cookie; добавляет `players`, `bots`, `spectators` к tick-метрикам. `/admin/health` через frontend не проксируется. |
| Игровой WebSocket | `GET /ws` (upgrade) | Игровые соединения; role определяется query-параметром `?role=player` или `?role=spectator`. |
| Player session | `POST /session`, `POST /ws/session` | Выдаёт/переиспользует HttpOnly cookie `player_session`; `DELETE` инвалидирует. |
| Admin API | `/admin/*` и алиасы `/ws/admin/*` | Cookie `admin_token`, выдаётся `POST /admin/login`. |

В production frontend слушает `:3000`, backend — `:8000`. Оба порта в
`docker-compose.yml` опубликованы только на `127.0.0.1`; наружу должен смотреть
TLS-терминатор, а не backend.

Readiness stale-порог: `max(2.0, tick_interval * 5)` секунд. При штатных
30 Гц это **2 секунды** (`tick_interval ≈ 33.3 мс`). `tick_errors`
увеличивается только при исключении в тике; успешный тик двигает
`last_tick_monotonic` и `tick_count`.

## 2. Топология и границы

```text
Браузер
  │ HTTPS (ожидается на edge)
  ▼
TLS-терминатор / reverse proxy        ← не входит в compose
  │ HTTP :3000 (рекомендуется; см. §9 про X-Real-IP)
  ▼
frontend nginx (non-root, :3000)
  ├── /, /assets        → статическая SPA
  ├── /health           → локальный liveness nginx
  └── /ws/*             → proxy_pass backend:8000
                              │
                              ▼
                        backend FastAPI (non-root appuser)
                              ├── in-memory World, sessions, WS
                              └── /app/data (named volume backend_config)
```

Важные следствия:

- Backend — **single process**. Игровое состояние, player-сессии и
  admin-сессии живут в памяти. Не запускайте несколько backend-реплик за одним
  балансировщиком: у них будут разные миры и разные cookie-сессии.
- `docker compose restart backend` и пересоздание контейнера сбрасывают игру,
  player-сессии и admin-сессии. Runtime-конфиг в volume при этом сохраняется.
- Frontend `:3000/health` остаётся зелёным, даже если backend или игра лежат.
  Для проверки игры используйте backend readiness, а не frontend health.
- Логи обоих сервисов ограничены `json-file` (`10 MB × 3` на сервис). Старые
  записи исчезают; при инциденте копируйте нужный фрагмент до рестарта.

## 3. Deploy

### 3.1. Preflight

Нужны Docker Engine с Compose v2 и заполненный `.env`. Если `.env` ещё нет:

```bash
cp .env.example .env
# отредактируйте .env: ADMIN_PASSWORD, ALLOWED_ORIGINS, FRONTEND_PORT, BACKEND_PORT
```

Минимально проверьте:

- `ADMIN_PASSWORD` задан и не равен `change-me`. В production без него
  админка отвечает `403`, а не использует dev-пароль.
- `ALLOWED_ORIGINS` содержит точный публичный origin, например
  `https://game.example`; список разделяется запятыми, wildcard не
  поддерживается. Пустое значение отключает браузерные origin.
- Порты на хосте не заняты; наружу опубликованы только loopback-порты.

Валидация compose и текущий статус:

```bash
docker compose config --quiet
docker compose ps
```

Перед обновлением, если backend уже запущен, снимите копию live-конфига:

```bash
mkdir -p backups
docker compose cp backend:/app/data/config.json \
  "backups/config-$(date +%Y%m%dT%H%M%S).json"
docker compose cp backend:/app/data/config.json.bak \
  "backups/config-$(date +%Y%m%dT%H%M%S).json.bak"
```

`date`-подстановка — пример для bash; в PowerShell подставьте timestamp
вручную. `docker compose cp` требует существующего контейнера (обычно
запущенного), а `docker compose exec` — только запущенного. На свежем volume
`.bak` ещё не существует (он появляется после первого сохранения из админки),
поэтому копирование `.bak` может завершиться ошибкой — это нормально, если
основной `config.json` уже сохранён.

### 3.2. Сборка и запуск

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

`docker compose up -d` пересоздаёт контейнеры, если образ изменился. Если нужно
гарантированно применить изменённые env-переменные:

```bash
docker compose up -d --force-recreate backend frontend
```

### 3.3. Проверка после deploy

```bash
# Liveness процесса
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/health

# Readiness игры: нужен HTTP 200 и свежий tick
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready

# Через frontend nginx (production-путь /ws)
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:3000/ws/ready

# Frontend liveness — только nginx
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:3000/health
```

Примеры используют POSIX shell. В PowerShell вызывайте `curl.exe`, а не
alias `curl` от `Invoke-WebRequest`, и подставляйте timestamp/ID вручную.

Ожидаемо:

- `/health` — `200 {"status":"ok"}`.
- `/ready` — `200`, `"status":"ready"`, `tick_age_ms` заметно меньше 2000,
  `tick_count` растёт при повторном запросе через 1–2 секунды.
- `/ws/ready` — тот же статус и тело, что `/ready` (алиас).
- `/health` frontend — `200 ok`, но это не доказательство живости игры.

Функциональный smoke: открыть игру, войти, повернуть змейку, обновить страницу
и убедиться, что reconnect сохраняет игрока; открыть `/admin`, войти и увидеть
здоровье/конфиг; при необходимости открыть spectator. Не проверяйте админку
через пароль в URL или query-параметрах.

### 3.4. Если deploy не поднялся

1. Не выполняйте `docker compose down -v`.
2. Соберите `docker compose ps`, `docker compose logs --tail=200 backend`,
   `docker compose logs --tail=200 frontend`, `docker stats --no-stream`.
3. Если backend падает на старте с `Invalid config file` — это fail-fast
   валидации; переходите к §5 (restore), не «исправляйте» файл вслепую.
4. Если сломан код, откатитесь по §4.1; конфиг-volume сохраняется.

## 4. Rollback

### 4.1. Откат кода

Release публикуется GitHub Actions (`.github/workflows/release.yml`) по тегу
`vX.Y.Z` (или вручную через `workflow_dispatch` с input `tag`). Pipeline
разделён на четыре шага:

1. `verify` — checkout только по `refs/tags/<tag>`, проверка, что commit тега
   совпадает с checkout, тег стоит на `main`/`dev`; lockfile, protobuf,
   аудит зависимостей, backend/frontend-тесты и build.
2. `publish` — собирает и пушит **только** `:sha-<12>`; version tag и `latest`
   на этом шаге не создаются. Если `:vX.Y.Z` уже существует, pipeline
   останавливается, чтобы не перезаписать релиз.
3. `smoke` — поднимает compose из digest-образов `:sha-<12>` и проверяет
   `/ready`, `/health`, `/ws/ready`, корневую страницу, WebSocket upgrade через
   nginx, non-root и OCI label `revision`.
4. `promote` — только после успешного smoke создаёт `:vX.Y.Z` по digest.
   `:latest` двигается только для stable push-тега, не для prerelease и не для
   `workflow_dispatch`.

Pipeline проверен на `v0.1.0-rc.3` и `v0.1.0`: для stable-тега `:v0.1.0`,
`:sha-<12>` и `:latest` указывают на один digest. `:sha-<12>` — staging-тег:
повторная сборка того же commit с другим version-label может его перезаписать
(так `sha-5e9dad95b5db` после stable-релиза стал равен `v0.1.0`). Для деплоя
берите digest из `release-manifest-<tag>`, а не `:sha-*`.

После `promote` скачайте artifact `release-manifest-<tag>`: в нём записаны
commit и digest'ы backend/frontend. Для rollback используйте digest, а не
только тег: тег может быть перезаписан или удалён, digest — нет.

Откат на предыдущий release — переключить digest-образы и перезапустить стек:

```bash
export BACKEND_IMAGE="ghcr.io/<repo>/backend@sha256:<digest>"
export FRONTEND_IMAGE="ghcr.io/<repo>/frontend@sha256:<digest>"
docker compose pull backend frontend
docker compose up -d --no-build --force-recreate
docker compose ps
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:3000/ws/ready
```

Образы можно задать в `.env` или окружении; без `BACKEND_IMAGE`/
`FRONTEND_IMAGE` compose использует локальные `polzuchie-tvari-*:local` и
собирает их из `build:`. Для приватного пакета GHCR на хосте нужен
`docker login ghcr.io` с classic PAT, у которого есть `read:packages`;
публичный пакет можно тянуть анонимно. Перед первым production-тегом
проверьте pull с чистого хоста, а не только из GitHub Actions.

Если `BACKEND_IMAGE`/`FRONTEND_IMAGE` заданы в `.env`, `unset` их не уберёт:
compose всё равно прочитает `.env`. Для source-rollback удалите или
закомментируйте эти строки в `.env` либо используйте отдельный env-file.

Если GHCR-образ нужной версии недоступен или проблема в инфраструктуре,
остаётся source-rollback — checkout известного рабочего commit/тега и
пересборка:

```bash
git log --oneline -10
git checkout <known-good-commit-or-tag>
unset BACKEND_IMAGE FRONTEND_IMAGE
docker compose build backend frontend
docker compose up -d
docker compose ps
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready
```

После `unset` и правки `.env` проверьте `docker compose config`, что образы
снова локальные, и только затем запускайте `build`.

Source-rollback ниже коммита перехода с bind-mount на named volume запрещён:
старый compose будет монтировать `./backend/config.json`, а live-конфиг лежит
в `backend_config`, поэтому стек может стартовать с другим конфигом. Если такой
откат всё же нужен, сначала снимите backup и перенесите конфиг вручную.

Не используйте `git reset --hard` на production-хосте, если в рабочем дереве
есть чужие изменения. Если откат кода меняет схему конфига, согласуйте его с
откатом конфига (§5): старый код может не принять новый `config.json`.

### 4.2. Откат только конфига

Если код здоров, а проблема появилась после сохранения настроек:

1. Сначала снимите текущий файл и `.bak` в `backups/` (команды §3.1).
2. Восстановите предыдущую версию по §5.
3. Проверьте `/ready` и админку; игра после рестарта начнётся заново.

### 4.3. Что откатывать нельзя автоматически

- Уже применённые изменения мира (пересозданные порталы/чёрные дыры, удалённая
  при resize еда) не восстанавливаются транзакционным rollback'ом конфига.
- Player/admin-сессии после перезапуска процесса не восстанавливаются: они
  in-memory.
- `docker compose down -v` удаляет volume `backend_config` вместе с live-конфигом
  и `.bak`. Это не rollback, а потеря данных.

## 5. Конфиг: backup, restore, ownership

### 5.1. Где лежит конфиг

| Путь | Назначение |
|---|---|
| `/app/data/config.json` | Live runtime-конфиг; читается и перезаписывается приложением. |
| `/app/data/config.json.bak` | Предыдущая версия, создаётся **перед каждой записью** из админки. Перезаписывается при следующем сохранении; это не архив. |
| `/app/data/config.schema-version` | Отдельный маркер версии схемы (сейчас `1`); не поле JSON. |
| `/app/config.example.json` | Seed-шаблон в образе; entrypoint копирует его только в пустой volume. |

`docker compose down` без `-v` и пересоздание контейнера конфиг сохраняют.
`down -v` удаляет named volume.

### 5.2. Восстановление из `.bak` при работающем контейнере

Сначала сохраните текущее состояние (даже если оно плохое) и проверьте, что
`.bak` существует:

```bash
docker compose exec backend ls -l /app/data/config.json /app/data/config.json.bak
docker compose exec -u root backend sh -c \
  'cp /app/data/config.json.bak /app/data/config.json && \
   chown appuser:appuser /app/data/config.json && \
   chmod 0644 /app/data/config.json'
docker compose restart backend
```

`docker compose cp`/`exec` от root создают файл с чужим владельцем. Без
`chown appuser:appuser` и `chmod 0644` приложение не сможет сохранять конфиг, а
entrypoint при следующем старте завершится ошибкой про ownership.

### 5.3. Восстановление из host-копии

```bash
docker compose up -d backend
docker compose cp ./backups/config-YYYYMMDDTHHMMSS.json \
  backend:/app/data/config.json
docker compose exec -u root backend sh -c \
  'chown appuser:appuser /app/data/config.json && \
   chmod 0644 /app/data/config.json'
docker compose restart backend
```

Если контейнер не поднимается из-за битого конфига и `exec` недоступен,
используйте one-off контейнер с тем же volume:

```bash
docker compose run --rm --no-deps --user root --entrypoint sh backend -c \
  'cp /app/data/config.json.bak /app/data/config.json && \
   chown appuser:appuser /app/data/config.json && \
   chmod 0644 /app/data/config.json'
```

Это запускает новый контейнер с volume сервиса, не трогая основной. После него
снова выполните `docker compose up -d backend`.

### 5.4. Проверка после restore

```bash
# JSON должен парситься
docker compose exec -T backend python -m json.tool /app/data/config.json >/dev/null

# Контейнер должен остаться живым и игра — готовой
docker compose ps
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready
```

Затем откройте админку и сверьте ключевые значения. Не редактируйте
`config.json` вручную «на лету»: это обходит Pydantic-валидацию, audit и
транзакционный backup/rollback. Штатный путь — PATCH через `/admin/config`.

Если версия схемы несовместима с новым кодом, автоматической миграции нет:
восстановите конфиг, соответствующий версии кода, либо начните с
`config.example.json` и перенесите настройки вручную. Не копируйте старый файл
поверх нового volume без проверки `config.schema-version`.

## 6. Health triage

### 6.1. Таблица состояний

| `/health` | `/ready` | Вероятная причина | Действие |
|---|---|---|---|
| `200` | `200` | Штатно | Проверять клиентов/сеть только при жалобах. |
| `200` | `503` | Игровой цикл завис, тик падает или event loop заблокирован | Смотреть `tick_errors`, логи, CPU/RAM; короткий ступор переждать, устойчивый — рестарт (§6.3). |
| non-200 / timeout | любой | Процесс/контейнер/порт/nginx | Проверить `docker compose ps`, exit code, OOM, логи; поднять сервис. |
| `200` | `200`, но клиенты не подключаются | Origin, cookie, TLS, role cap, `4029`, сеть | §7 и §9. |

`/health` и `/ready` — разные сигналы. Не перезапускайте игру только потому,
что readiness мигнул на один опрос: при 30 Гц порог и так 2 секунды, а
Docker healthcheck смотрит только `/health` и не убивает контейнер из-за
короткого stale tick.

### 6.2. Сбор диагностики

```bash
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/health
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready
docker compose ps
docker compose logs --since=15m --timestamps backend
docker compose logs --since=15m --timestamps frontend
docker stats --no-stream
```

В `/ready` смотрите:

- `tick_age_ms` — насколько давно был успешный тик. Выше порога
  `max(2.0, tick_interval * 5)` секунд — это уже `503 stale`.
- `tick_count` — должен расти. Два одинаковых значения с интервалом 2 секунды
  означают, что успешных тиков не было.
- `tick_errors` — растёт при исключениях в `game_loop`; это не то же самое, что
  медленный тик.
- `tick_duration_ms` — длительность последнего успешного тика. При 30 Гц бюджет
  около 33 мс; устойчивое приближение к бюджету означает нехватку CPU или
  тяжёлую сериализацию, а не «нормальный jitter».

В логах ищите `Game tick failed`, `Failed to serialize client`,
`Sender loop failed`, `Traceback`, `Invalid config file`, `OOMKilled`.

### 6.3. Рестарт при устойчивом stale tick

Сначала сохраните evidence: вывод `/ready`, `docker compose ps`, последние
200–500 строк логов, `docker stats --no-stream`, значение
`docker inspect ... OOMKilled/ExitCode`.

Если event loop отвечает и нужен сброс игрового мира, можно использовать
admin restart (`POST /admin/restart` из админки). Если процесс или event loop
завис, admin endpoint может не ответить — тогда:

```bash
docker compose restart backend
```

Помните: **admin restart** сбрасывает игровой мир, но не перезапускает процесс
и не очищает in-memory store'ы, поэтому admin/player-сессии могут остаться
валидными. **`docker compose restart backend`** перезапускает процесс и
инвалидирует обе in-memory сессии: игроки получат новый мир и, как правило,
новую identity. Конфиг в volume сохраняется в обоих случаях. После рестарта:

```bash
docker compose ps
curl -sS -o - -w '\nHTTP %{http_code}\n' http://127.0.0.1:8000/ready
docker compose logs --tail=100 backend
```

Повторный `503` после рестарта — не «ещё подождать», а новая причина:
проверьте конфиг, CPU/OOM и последний traceback.

## 7. WebSocket saturation и лимиты

| Параметр | По умолчанию | Смысл |
|---|---:|---|
| `MAX_PLAYER_CONNECTIONS` | `50` | Активные player-соединения; takeover не занимает новый слот. |
| `MAX_SPECTATOR_CONNECTIONS` | `100` | Активные spectator-соединения; не расходуют player-лимит. |
| `WS_HANDSHAKE_RATE_LIMIT` | `30` | Попыток handshake на IP за окно. |
| `WS_HANDSHAKE_WINDOW_SECONDS` | `10` | Окно per-IP лимита. |
| `RATE_LIMIT_PER_SECOND` (код) | `50` | Входящих команд на соединение в секунду. |
| `MAX_CLIENT_MESSAGE_LENGTH` (код) | `32` | Символов в игровой команде; более длинные игнорируются. |
| `ws_max_size` (Docker/uvicorn) | `4096` | Максимальный размер входящего WS-сообщения. |

Коды закрытия, которые видит клиент:

| Код | Причина | Что делать |
|---|---|---|
| `1008` | Origin не входит в `ALLOWED_ORIGINS` | Сверить публичный origin, схему и порт; не добавлять wildcard. |
| `4002` | Player cap | Проверить, не залипли ли соединения; повышать лимит только после CPU/RAM-проверки. |
| `4003` | Spectator cap | Отдельный лимит; spectator flood не должен вытеснять игроков. |
| `4029` | Per-IP handshake bucket | Проверить NAT/proxy: все клиенты могут выглядеть одним IP (§9). |
| `1011` | Sender не смог отправить кадр | Смотреть backend-лог; мёртвое соединение должно освободить слот. |
| `1012` | Restart/drain или соединение вытеснено новым handshake | Штатное поведение при рестарте/takeover. |

Где смотреть:

- Браузер: DevTools → Network → WS → Close code/reason; Console — ошибки
  Worker/WebGL.
- nginx: access log покажет HTTP upgrade (`101`) и разрывы, но не application
  close code. `docker compose logs frontend`.
- Backend: `docker compose logs backend`; явных per-close audit-записей нет,
  поэтому код отказа надёжнее смотреть на клиенте. Предупреждение о
  deprecated `client_id` в query также пишется в лог.

Если `4029` массовый, сначала проверьте `TRUST_PROXY_HEADERS` и топологию
прокси. Повышение `WS_HANDSHAKE_RATE_LIMIT` без исправления IP-определения
только маскирует проблему и ослабляет защиту. Изменение env требует
пересоздания контейнера:

```bash
docker compose up -d --force-recreate backend
```

## 8. OOM, CPU и деградация

Лимиты из `docker-compose.yml`:

| Сервис | CPU limit | Memory limit |
|---|---:|---:|
| backend | `1.5` | `1G` |
| frontend | `0.8` | `512M` |

Проверка:

```bash
docker stats --no-stream
backend_id="$(docker compose ps -q backend)"
docker inspect --format \
  'status={{.State.Status}} oom={{.State.OOMKilled}} exit={{.State.ExitCode}}' \
  "$backend_id"
docker compose logs --tail=200 backend
```

Признаки:

- `oom=true` или exit code `137` — контейнер убит по памяти. Соберите логи,
  уменьшите нагрузку (боты, `target_food_count`, число игроков/спектаторов) или
  увеличьте memory limit с учётом ёмкости хоста. Не поднимайте лимит вслепую:
  OOM может быть следствием утечки или FULL-шторма.
- CPU постоянно у предела, `tick_duration_ms` близок к 33 мс — проверьте число
  ботов, медленных клиентов, частоту FULL/RESYNC и размер кадра.
- Frontend-контейнер — это только nginx; его CPU/RAM не отражают нагрузку
  WebGL на клиентских машинах. Не диагностируйте «тормоза игры» по
  `docker stats frontend`.

Логи ограничены `10 MB × 3`; при инциденте копируйте нужный диапазон наружу
до рестарта, иначе ротация уничтожит evidence.

## 9. TLS, origins и proxy headers

### 9.1. Ожидаемая TLS-схема

Compose **не терминирует TLS**: frontend nginx слушает HTTP `:3000`, backend —
HTTP `:8000`, оба опубликованы на `127.0.0.1`. Публичный HTTPS должен
завершаться на внешнем reverse proxy/ingress:

```text
браузер --HTTPS--> edge --HTTP--> frontend:3000 --/ws--> backend:8000
```

Требования к edge:

- Проксировать HTTPS на frontend `:3000` (или раздельно: статику на frontend,
  `/ws` на backend — см. ниже).
- Передавать `Host` и `X-Forwarded-Proto: https`; frontend nginx использует
  `X-Forwarded-Proto` для `X-Forwarded-Proto` в backend, а backend по нему
  выставляет `Secure` у cookie.
- Не открывать `:8000` в интернет. Backend доверяет forwarding-заголовкам в
  production (`TRUST_PROXY_HEADERS` по умолчанию `true`); прямой доступ к нему
  позволяет подделать IP и обойти per-IP лимиты.
- Не ослаблять CSP/security headers из `frontend/nginx.conf` ради обхода
  ошибки деплоя.

`ALLOWED_ORIGINS` задаётся точным публичным origin, например:

```dotenv
ALLOWED_ORIGINS=https://game.example
```

Если frontend опубликован на нестандартном порту, порт входит в origin:
`https://game.example:8443`. Список — через запятую; пустое значение запрещает
браузерные origin. CORS REST и WS используют один и тот же список.

### 9.2. `TRUST_PROXY_HEADERS` и реальный IP

| Значение | Когда использовать |
|---|---|
| `1` (production default) | Backend доступен только через доверенный nginx/proxy, который перезаписывает `X-Real-IP`; WS берёт `X-Real-IP` или первый `X-Forwarded-For`, admin login — только `X-Real-IP`. |
| `0` | Backend доступен напрямую или proxy не контролируется; forwarding-заголовки игнорируются, ключ — socket peer. |

Текущий `frontend/nginx.conf` всегда перезаписывает `X-Real-IP` значением
`$remote_addr` и `X-Forwarded-For` — адресом непосредственного peer. Поэтому
если перед frontend стоит **ещё один** TLS-прокси, backend увидит IP этого
прокси у всех клиентов: per-IP handshake bucket схлопнется, и пользователи
начнут получать `4029`. Варианты:

1. Настроить на frontend nginx `real_ip`/`set_real_ip_from` для доверенного
   edge (в текущем конфиге этого нет; это изменение кода/конфига, не runbook).
2. Направить edge-трафик `/ws` напрямую в backend `:8000`, а статику — в
   frontend `:3000`; тогда backend видит edge как peer, а edge обязан
   передавать настоящий `X-Real-IP`.

Не включайте `TRUST_PROXY_HEADERS=1` «на всякий случай» без доверенного proxy:
это позволяет подделать IP и обойти лимиты. И наоборот, `0` за nginx без
real-IP-настройки соберёт всех клиентов в один bucket.

### 9.3. Security headers frontend

`frontend/nginx.conf` добавляет `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS и CSP.
CSP разрешает только same-origin скрипты, `worker-src 'self' blob:`, `ws:`/`wss:`
для connect; inline-style разрешён, inline-script — нет. Если edge снимает или
перезаписывает эти заголовки, приложение становится менее защищённым; проверьте
ответ edge после деплоя.

## 10. Worker/WebGL overlay на клиенте

Это клиентская диагностика; она не требует рестарта backend, если сервер
готов.

- **Worker watchdog.** После 30 подряд 100-мс таймаутов кадра main-thread
  считает worker зависшим, пересоздаёт его с backoff (до 3 попыток), затем
  показывает фатальный overlay с reload. В DevTools смотрите Console/Worker,
  ошибки `onerror`/`onmessageerror`, статус `reconnecting`.
- **WebGL context loss.** На player-route `webglcontextlost` останавливает rAF
  и показывает `GameErrorOverlay` с кнопкой Reload; spectator на эти события не
  подписан и продолжает тикать (его `SceneManager.render` early-return'ит на
  время loss). После `webglcontextrestored` `SceneManager` пересобирает
  composer/bloom/contact-shadow targets, shadow map и `GpuTimer`, player снимает
  overlay, а loop продолжается без reload; spectator просто возобновляет рендер.
  Если restore не пришёл или rebuild упал, player остаётся с overlay и reload
  (см. `GAME_STATE.md`, ограничения). Наблюдаемость: `document.body.dataset.gameFrames`
  (player-route) растёт только пока rAF-loop живой — по нему в DevTools видно,
  что loop возобновился, а не только исчез overlay.
- **Локальная проверка.** Попробуйте hard reload, затем временно выставьте
  `localStorage["snake-quality"]="low"` и перезагрузите страницу. Это снижает
  нагрузку на слабом GPU, но не лечит ошибку backend.
- **Массовый overlay после deploy.** Проверьте, что браузер получил новые
  assets (cache/Hard reload), что CSP/edge не блокирует `worker-src`/`connect-src`,
  и что `/ws` доступен по `wss` при HTTPS (mixed content). Если сервер readiness
  зелёный, а падают все клиенты — ищите изменение frontend-сборки или edge, а не
  перезапускайте игру вслепую.

## 11. Логи и audit

```bash
docker compose logs --since=30m --timestamps backend
docker compose logs --since=30m --timestamps frontend
```

Audit-записи admin API — JSON-строки в backend-логе: `timestamp`, `event`
(`login`/`config`/`restart`), `ip`, `result`, а для config — только
верхнеуровневые `keys`. Пароли, session-токены и значения конфига туда не
попадают.

```bash
# bash
docker compose logs --no-color backend | grep '"event": "login"'
docker compose logs --no-color backend | grep '"event": "config"'

# PowerShell
docker compose logs --no-color backend | Select-String '"event": "login"'
```

Если в логах всё же оказался секрет: сохраните evidence в защищённое место,
не пересылайте его в открытые каналы, смените `ADMIN_PASSWORD`, перезапустите
backend (это инвалидирует admin/player-сессии) и действуйте по
[`SECURITY.md`](SECURITY.md). Нельзя «отозвать» отдельный player-token без
удаления cookie/сессии; для player-сессии используйте logout/`DELETE /session`.

## 12. Учебный drill log (tabletop)

> **Это tabletop, а не production incident.** Сценарий разобран по текущему
> коду и конфигам 2026-11-02. Production-логи, времена, графики и факты
> реального сбоя здесь не приводятся. Команды в этом разделе не выполнялись
> на production; «фактический результат» описывает подтверждённую ветку
> поведения, а не измеренный инцидент.

**Сценарий:** игровой цикл перестал тикать → liveness остаётся зелёным →
readiness отдаёт `503` → диагностика → рестарт backend → восстановление.

| # | Шаг | Ожидаемый результат | Фактический результат (tabletop) |
|---|---|---|---|
| 1 | Зафиксировать время, внешние симптомы, затронутых игроков | Есть точка отсчёта и evidence до изменений | Симптомы не выдумываются; в таблице только проверяемая ветка кода |
| 2 | `curl /health` | `200 {"status":"ok"}` даже при зависшем тике | Подтверждено `health_check` и `test_health_stays_liveness_when_tick_is_stale` |
| 3 | `curl /ready` | `503 {"status":"stale", ...}`; `tick_age_ms` выше `max(2.0, tick_interval*5)`, `tick_count` не растёт | Подтверждено `readiness_check` и `test_ready_is_fresh_then_stale_with_tick_metrics` |
| 4 | Снять `docker compose ps`, `/ready`, `docker stats`, последние логи | Есть `tick_errors`, traceback `Game tick failed` или признаки OOM/CPU | Маршруты сбора и поля метрик проверены по `server.game_loop` и `admin.py` |
| 5 | Переждать один stale-порог (2 с при 30 Гц) и повторить `/ready` | Краткий ступор проходит без рестарта; устойчивый — остаётся `503` | Порог и поведение подтверждены тестом; production-замер не проводился |
| 6 | При устойчивом `503` — сохранить evidence и выполнить `docker compose restart backend` (или admin restart, если event loop отвечает) | Compose restart: процесс и мир перезапускаются, player/admin-сессии инвалидируются. Admin restart: мир сбрасывается, но процесс и session store живут. Конфиг в volume сохраняется в обоих случаях | Разница между compose restart и admin restart сверена с `docker-compose.yml`, `server.lifespan` и in-memory store |
| 7 | `curl /ready` + повторный `tick_count`, открыть игру | `200 "ready"`, `tick_count` растёт, клиент снова подключается | Readiness-паритет подтверждён тестом `test_ws_ready_has_parity_with_ready`; клиентский reconnect в tabletop не проверялся |
| 8 | Post-incident: проверить `config.json`, сохранить логи, записать причину | Конфиг валиден, evidence сохранён, причина классифицирована | Процедура restore/валидации описана в §5; реальный инцидент не заявляется |

**Границы drill:** это не доказательство того, что production переживёт
реальный сбой, и не заменяет периодическое упражнение на staging. Для
настоящего drill повторите шаги на изолированном compose-стенде и приложите
фактические `/ready`-ответы, логи и время рестарта. Для проверки кода
используйте [`backend/tests/test_health_ready.py`](backend/tests/test_health_ready.py).

**Локальное подтверждение кода (не production drill):**
`cd backend && uv run --frozen pytest tests/test_health_ready.py -q` →
`7 passed in 1.03s` (2026-11-02). Это проверяет liveness/readiness и
tick-метрики, но не заменяет учебный или production-прогон с реальным
рестартом.
