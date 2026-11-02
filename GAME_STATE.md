# Текущее состояние проекта (GAME_STATE)

> Актуальный срез реализации: что работает, какие инварианты нельзя нарушать и
> какие ограничения действуют сейчас. Это не changelog.
>
> История M1–M5, старые фиксы и длинные описания итераций перенесены в
> [`docs/HISTORY.md`](docs/HISTORY.md). Устройство потоков данных и межстековые
> зависимости — в [`ARCHITECTURE.md`](ARCHITECTURE.md), карта файлов — в
> [`PROJECT_MAP.md`](PROJECT_MAP.md).

## Статус

Проект находится в рабочем production-ready состоянии для текущего объёма:
авторитетная серверная симуляция, браузерный клиент с Web Worker, React-UI,
админка и Docker-развёртывание. Критичных незакрытых дефектов нет; дальнейшие
улучшения вынесены в `REMEDIATION_PLAN.md` (M6) и не блокируют запуск.

## Что работает сейчас

### Симуляция и сервер

- Авторитетный тик 30 Гц: физика, повороты/буст, рост, коллизии, еда, порталы,
  чёрные дыры, надгробия и боты выполняются на сервере; клиент только
  интерполирует и предсказывает камеру.
- Тороидальная карта с динамическими `world.width/height`; серверные позиции —
  в grid-единицах, клиентские world-единицы — `grid * gridSize`.
- Пространственный индекс строится один раз за тик (`CELL_SIZE = 10.0`);
  видимость считается по AoI, а не по полной карте.
- Серверные боты — обычные `Player` без WebSocket: lifecycle, respawn,
  personalities (mixed/collector/aggressive/coward) и live-настройка из админки.
- Смерть/удаление игрока идемпотентны; события удаления применяются на границе
  тика, поэтому killfeed и выпавшая еда не теряются при disconnect между тиками.

### Сеть и синхронизация

- WebSocket + Protobuf; кадр сжимается `zlib.compress(level=1)` в
  `asyncio.to_thread`; `permessage-deflate` отключён, входящие сообщения
  ограничены `ws_max_size=4096`, клиентские команды — 32 символами.
- FULL/DELTA, `frame_seq`/`server_tick` увеличиваются ровно один раз за тик;
  клиент отслеживает uint32-цепочку и при разрыве или ошибке декодирования
  запрашивает `RESYNC` (cooldown 1 с на соединение).
- Один builder FULL-кадра используется для handshake, late join и RESYNC;
  initial snapshot собирается в event loop, сжатие уходит в рабочий поток.
- Backpressure sender-очереди: один слот на клиента, явные `QueueStatus`,
  FULL не строится повторно при заполненной очереди, мёртвый sender закрывает
  соединение кодом `1011` и не оставляет слот в `active_connections`.
- Клиентский воркер: очередь интерполяции до 20 состояний, `requestId`-
  корреляция кадров, watchdog (30 таймаутов подряд), до 3 рестартов worker с
  backoff, затем фатальный overlay с reload.

### Игроки, сессии и права

- Игровая identity — HttpOnly cookie `player_session` (`SameSite=Lax`,
  `Secure` за HTTPS), TTL 30 дней, cap 10 000, rate limit 30/мин на IP.
  `client_id` в WS URL больше не является credential и игнорируется.
- Spectator всегда получает собственный UUID и не резолвит player-cookie;
  takeover player-сессии между вкладками идёт через Web Locks + BroadcastChannel.
- Reconnect защищён epoch-ами и pending reservation: старый handshake не может
  перезаписать новую сессию; restart/draining закрывает соединения кодом 1012.
- Origin проверяется по точному allowlist; действуют role caps
  (`MAX_PLAYER_CONNECTIONS=50`, `MAX_SPECTATOR_CONNECTIONS=100`) и per-IP
  handshake-лимит (`30` за `10` секунд). Отказы: `1008`, `4002`, `4003`, `4029`.
- Админка авторизуется серверной session-cookie `admin_token` (HttpOnly,
  SameSite=Strict, TTL 12 ч), а не паролем в `localStorage` или заголовке.
  Login rate limit ограничен, privileged-действия пишутся в JSON audit без
  паролей, токенов и значений конфига.

### Конфигурация и эксплуатация

- `GameConfig` валидируется строго: типы, finite-значения, диапазоны; битый
  `config.json` останавливает старт, а не подменяется defaults.
- PATCH `/admin/config` проходит Pydantic-схему на HTTP-границе, затем
  транзакционный apply: backup `config.json.bak`, запись через `os.replace`
  (fallback для single-file mount), rollback памяти и файла при ошибке.
- Runtime-конфиг не хранится в git: `backend/config.example.json` — seed,
  `backend/config.schema-version` — отдельный маркер версии. Docker монтирует
  named volume `backend_config` в `/app/data`; entrypoint не перезаписывает
  существующий live-конфиг и проверяет ownership/записываемость.
- `/health` и `/ws/health` — liveness (всегда `200 {"status":"ok"}`);
  `/ready` и `/ws/ready` — readiness с `tick_age_ms`, `tick_count`,
  `tick_duration_ms`, `tick_errors` и `503` при устаревшем heartbeat.
- Docker-образы работают non-root (backend `appuser`, frontend `nginx`),
  base images закреплены digest'ами, healthcheck локальный, логи ограничены
  `json-file` (`10m × 3`).

### Клиент и рендер

- Three.js-рендер: instanced еда/порталы/чёрные дыры/частицы/надгробия, тени,
  contact shadow змейки, трава/камни, bloom-маска, атмосферный grade и
  линзирование чёрных дыр.
- Пресеты качества Auto/High/Medium/Low управляют pixel ratio, тенями, bloom,
  плотностью декора и бюджетом snake-light'ов; Auto адаптирует pixel ratio по
  frame time.
- React 19: login, HUD (счёт/лидерборд/killfeed/ping), settings, game-over,
  spectator HUD и админка; игровые обновления проходят через throttled store,
  а не через React на 30–60 FPS.
- Модалки (game-over, session-moved, settings drawer, renderer error) используют
  `role="dialog"`/`role="alertdialog"`, `aria-modal` и `aria-labelledby`, а
  также общий `useFocusTrap`: начальный фокус, удержание Tab/Shift+Tab и
  возврат прежнего фокуса при закрытии/unmount. Escape закрывает settings.
- KillFeed объявлен как `role="log"` с `aria-live="polite"` и
  `aria-relevant="additions"`; статусы подключения GameHud и SpectatorHud
  (`connecting`/`live`/`reconnecting`) идут через `role="status"` и
  `aria-live="polite"`, без озвучивания каждого тика.
- Необязательные `localStorage`-обращения (quality, FPS, личный рекорд,
  spectator FPS) идут через `safeStorage.get/set/remove`, который глотает
  исключения private mode/quota/blocked storage; ключи не изменились.
- Spectator-камера использует pointer events: один палец/ЛКМ панорамирует,
  два пальца делают pinch-zoom, wheel-zoom сохранён; touch-action ограничен
  spectator-маршрутом, desktop-поведение не меняется.
- Миникарта обновляется с throttle 12 Гц (`MINIMAP_UPDATE_INTERVAL_MS`) и
  рисует не больше `MAX_MINIMAP_FOODS = 300` food-точек; пропущенные кадры не
  накапливаются. Голова берётся из `head_x/head_y` или плоского `body`, legacy
  object-body и auto-correct value/color удалены.
- Потеря WebGL-контекста и фатальный сбой worker показывают блокирующий
  `GameErrorOverlay` с reload; после `webglcontextrestored` полноценный rebuild
  пока не выполняется, нужен reload.
- Runtime-проверка Worker/WebGL2 выполняется до login; при отсутствии
  поддержки показывается понятная ошибка вместо пустого экрана.
- Игровой bundle загружается лениво: `bootstrap` не импортирует `Game`
  статически, `Game`/`SceneManager`/Three подтягиваются динамическим import
  только после Play; login остаётся видимым с busy-состоянием, пока chunk
  грузится. Сборка выносит `three`/`postprocessing` в `vendor-three`,
  React/ReactDOM — в `vendor-react`; ошибка загрузки chunk возвращается в
  login, а не оставляет пустой экран.

## Архитектурные инварианты

1. **Тороидальная математика** существует только в
   `frontend/src/worker/shared/MathUtils.ts` и
   `backend/app/engine/systems/math_utils.py`. Менять обе стороны вместе и
   держать `tests_shared/golden_vectors/math.json` зелёным.
2. **Сетевой кадр** определяется `tests_shared/snake.proto`,
   `serialization.py`, `ProtoFrameDecoder.ts` и `DeltaDecoder.ts`. При
   изменении формата синхронно обновлять все стороны и golden-кадры.
3. **Тело игрока** — плоский массив `[x0, y0, ...]` с головой первой. Сервер
   разворачивает `new_heads_this_tick` после тика; `getNewBody` в
   `DeltaDecoder.ts` рассчитывает на этот порядок.
4. **Truth table тела:** alive+in-AoI — полное тело; alive+out-AoI — одна точка
   и `body_truncated=true`; dead — пустое тело, `length=0`, `final_length`
   сохранён. `length=1` без флага — реальная односегментная змея.
5. **`frame_seq`/`server_tick`** двигаются один раз за тик в `game.py`; FULL,
   DELTA и config broadcast одного тика несут одинаковый seq. `reset_state()`
   сбрасывает счётчики.
6. **Координаты:** сервер — grid-единицы; клиент — `grid * gridSize`
   (`gridSize=20`) через `WorldMath.ts`; серверный spatial grid —
   `CELL_SIZE=10`; fog/AoI переводится как `world / 20`.
7. **Spectator identity** независима от player identity: спектатор никогда не
   переиспользует `client_id` игрока.
8. **Чёрные дыры:** таймеры/рост/смена состояний обновляются один раз за тик
   оркестратором (`app/engine/game.py`), `gravity.py` применяет только
   притяжение и гибель.
9. **`World.reset_state()`** очищает игроков, еду, элементы мира, tombstones,
   spectators, input queue, pending removals и per-tick caches.
10. **События удаления** ставятся в `pending_removals` и применяются в начале
    тика до систем, чтобы события попадали в тот же кадр.
11. **Конфиг** применяется транзакционно: validation → apply → backup/write;
    ошибка apply/save откатывает память и файл, HTTP отдаёт 400/503, не 500.
12. **Админ-аутентификация** — только серверная HttpOnly cookie; пароль не
    хранится в `localStorage` и не отправляется в custom headers.
13. **Liveness ≠ readiness:** `/health` не зависит от игры; `/ready` становится
    `503`, если тик не двигал heartbeat дольше
    `max(2.0, tick_interval * 5)` секунд.
14. **Один player-сеанс на браузер:** Web Lock `snake-player-session`;
    takeover через BroadcastChannel; без Web Locks — прежнее поведение.

## Активные ограничения и известные риски

- **Медленный клиент и FULL-шторм.** Backpressure и `RESYNC`-cooldown снижают
  риск, но при систематических пропусках кадров возможны всплески трафика и
  CPU из-за повторных FULL-синхронизаций.
- **WebGL restore неполный.** После потери контекста `webglcontextrestored`
  только снимает флаг; composer targets, materials и shadow maps не
  пересобираются, поэтому пользователю предлагается reload (M6-13).
- **SSAO временно выключен** флагом в `PostProcessing.buildPipeline`; код
  оставлен компилируемым до визуальной приёмки contact shadow.
- **Крупный `vendor-three` chunk.** Three/postprocessing (~646 kB minified)
  вынесен из login-графа, но остаётся отдельным тяжёлым chunk'ом после Play;
  предупреждение Vite о размере >500 kB сохраняется.
- **Крупные god-объекты.** `World` и `SceneManager` остаются точками
  сопровождения; их разделение — M6-08/M6-09.
- **Ручной Protobuf-декодер.** `ProtoFrameDecoder.ts` не использует runtime
  `protobufjs`; любое изменение `snake.proto` требует синхронного обновления
  декодера, `snake_pb2.py` и golden-фикстур.
- **Нет автоматических миграций конфига.** `config.schema-version` — только
  маркер; при несовместимом изменении схемы нужно обновить пример, версию и
  перенести volume вручную.
- **Сессии in-memory.** Перезапуск backend инвалидирует player/admin-сессии;
  это осознанное ограничение текущего single-process развёртывания.
- **`docker compose down -v` уничтожает live-конфиг** вместе с volume
  `backend_config`; backup делается только перед сохранением из админки.
- **Доверие proxy-заголовкам** должно соответствовать топологии: включать
  `TRUST_PROXY_HEADERS` только за nginx, иначе IP-лимиты можно обойти/схлопнуть.
- **Нет GPU-based adaptive resolution** (Auto ориентируется на frame time) и
  нет визуальных snapshot-тестов E2E.

## WIP и сломанное

Критичных незакрытых дефектов и известных «сломанных» механик нет. Задачи,
которые сознательно отложены (prediction/reconciliation, split `World`/
`SceneManager`, полный WebGL rebuild, CD, расширение E2E), перечислены в
`REMEDIATION_PLAN.md` как M6 backlog.

## Проверки

Число тестов намеренно не фиксируется в документации: оно меняется при каждом
добавлении регрессии. Актуальные команды — в `README.md` и
`.opencode/instructions/project.md`; полный прогон:

```bash
uv run --project backend python scripts/run_checks.py all
```

## Документация

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — потоки данных и инварианты.
- [`PROJECT_MAP.md`](PROJECT_MAP.md) — карта файлов и ответственность.
- [`docs/HISTORY.md`](docs/HISTORY.md) — история M1–M5 и старых итераций.
- [`README.md`](README.md) — quickstart, Docker, E2E и эксплуатация.
- [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) — план remediation и M6 backlog.
