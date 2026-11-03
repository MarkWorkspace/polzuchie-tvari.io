# Архитектура проекта Polzuchie-tvari.io (Snake AI)

## Потоки данных

### 1. Поток состояния: Сервер → Воркер → Main Thread → Рендер

Цепочка движения и преобразования данных от игрового состояния на сервере до вызова отрисовки в WebGL:

```
[FastAPI Game Tick]
       │
       ▼ (Protobuf Serialization & AoI-фильтрация)
[serialization.py]
       │
       ▼ (zlib.compress с уровнем сжатия 1)
[server.py]
       │
       ▼ (WebSocket: бинарный arraybuffer фрейм)
[WebSocket Connection]
       │
       ▼ (Прием сообщения)
[WebSocketClient (Worker)]
       │
       ▼ (Декомпрессия pako.inflate)
[DeltaDecoder.decompress]
       │
       ▼ (Декодирование Protobuf GameStateFrame)
[WebSocketClient._handleMessage]
       │
       ▼ (Плоские массивы [x0, y0, ...], данные игроков не копируются в Point[])
[DeltaDecoder.decodeDeltaState / decodeFullState]
       │
       ▼ (Добавление состояния в очередь)
[StateInterpolator.pushState]
       │
       ▼ (Интерполяция на основе dt по запросу REQUEST_FRAME)
[StateInterpolator.interpolate]
       │
       ▼ (Предсказание камеры, сплайны, меши, глаза, частицы)
[FrameComputer & SnakeProcessor]
       │
       ▼ (Типизированные массивы в качестве Transferable Objects)
[postMessage (Worker -> Main Thread)]
       │
       ▼ (Прием кадра)
[NetworkManager -> Game.ts]
       │
       ▼ (requestAnimationFrame)
[RenderOrchestrator.updateAndRender]
       │
       ▼ (Рендеринг сцены, линзирование, туман)
[SceneManager & Individual Renderers & PostProcessing]
```

**Детализация шагов и форматы данных:**
1. **FastAPI Game State (Сервер):**
   - На каждом тике (30 Гц) оркестратор [game.py](backend/app/engine/game.py) сначала применяет `pending_removals` на границе тика (чтобы killfeed/food drop от disconnect попали в тот же кадр), затем вызывает системы через registry и один раз увеличивает `server_tick`/`frame_seq` после всех мутаций. Состояние живёт в [state.py](backend/app/engine/state.py).
   - Опциональные серверные боты живут в изолированном пакете `backend/app/bots/`: `server.py` запускает `BotManager` в lifespan, `game_loop` вызывает `world.bot_manager.update()` перед тиком. Боты — обычные `Player` в `state.players` без WebSocket-соединения, поэтому сериализация, коллизии, еда и лидерборд работают для них без специальных веток.
   - [serialization.py](backend/app/engine/systems/serialization.py) кэширует Protobuf-сообщения игроков на тик и собирает `GameStateFrame` по схеме `tests_shared/snake.proto`. Для экономии трафика координаты змеек передаются плоскими массивами `[x0, y0, x1, y1, ...]`; тело сериализуется по truth table (alive/in-AoI, alive/out-AoI с `body_truncated`, dead с `final_length`). FULL для handshake, late join и RESYNC собирает один `build_full_frame`.
   - В [server.py](backend/server.py) и `process_client` Protobuf-кадр сжимается `zlib.compress(..., level=1)` в `asyncio.to_thread`; initial handshake собирает snapshot в event loop, а в поток уходит только сжатие. `frame_seq`/`server_tick` общие для всех клиентов одного тика.
   - **Формат границы:** Бинарный сжатый Protobuf (zlib/deflate). `permessage-deflate` на уровне WebSocket отключён (`--ws-per-message-deflate false`): кадр уже сжат, второй deflate только тратит CPU и добавляет байты. `--ws-max-size 4096` ограничивает входящие сообщения, которые по протоколу не превышают 32 байт.
   - `snake_pb2.py` генерируется только скриптом `backend/scripts/generate_proto.py`; CI перегенерирует его и падает при расхождении с закоммиченным файлом.

2. **WebSocket Connection (Сеть):**
   - Передача через WebSocket в бинарном режиме (`arraybuffer`). Игровая identity приходит из HttpOnly cookie `player_session` на handshake; query-параметр `client_id` оставлен только для совместимости, игнорируется и не является credential. Spectator cookie не резолвит и всегда получает новый UUID.
   - До `accept()` проверяются точный Origin allowlist, per-IP handshake bucket и role cap через атомарный pending reservation; отказы приходят кодами `1008`/`4002`/`4003`/`4029`. Reconnect защищён epoch-ами, а restart/drain закрывает соединения кодом `1012`.
   - Текстовый `RESYNC` обрабатывается отдельно от игрового ввода: ставит `needs_full_sync`, дренирует one-slot очередь и ограничен cooldown `1 с` на соединение.

3. **WebSocketClient (Воркер):**
   - Получает `arraybuffer` в `_handleMessage`.
   - Передает в [DeltaDecoder.decompress()](frontend/src/worker/DeltaDecoder.ts#L5), который использует `pako.inflate`.
   - Декодирует распакованный буфер с помощью минимального [ProtoFrameDecoder.ts](frontend/src/worker/shared/ProtoFrameDecoder.ts). `FrameSequencer` проверяет uint32-цепочку `frame_seq`: FULL открывает её, DELTA принимается только как `lastSeq + 1`, разрыв или ошибка декодирования инвалидируют цепочку и инициируют `RESYNC` (с клиентским cooldown 1 с).
   - **Формат границы:** JS Object с сырыми сетевыми данными.

4. **DeltaDecoder (Воркер):**
   - `decodeFullState` / `decodeDeltaState` работают с плоскими массивами чисел: тело остаётся `number[]` (`[x0, y0, ...]`), а не массивом `{x, y}`.
   - Для DELTA применяет `eaten_foods`/`moved_foods`/`new_foods`, фильтрует новую еду по границам карты и склеивает тело по truth table. Для dead/truncated сохраняет `head_x/head_y` для миникарты, а `getNewBody` клампит заявленную длину до восстановимого размера.
   - Возвращает структурированный `GameState` объект.

5. **StateInterpolator (Воркер):**
   - Помещает новое состояние в очередь `queue` (максимум 20 элементов), сглаживая timestamp low-pass фильтром и snap'ом при дрейфе > 200 мс.
   - При запросе кадра интерполирует между состояниями вокруг `renderTime` с целевой задержкой 3 тика и адаптивной скоростью воспроизведения; при одном состоянии отдаёт его как есть.

6. **FrameComputer & SnakeProcessor (Воркер):**
   - По запросу `REQUEST_FRAME` (с `requestId`, `dt`, `myId`, `isSpectator`, `localInput`, `spectatorCam?`) воркер вызывает `computeFrame` с типизированным `FrameContext`; типы границы определены в [WorkerProtocol.ts](frontend/src/worker/shared/WorkerProtocol.ts).
   - Выполняет предсказание локального игрока с помощью [CameraPredictor.predict](frontend/src/worker/CameraPredictor.ts#L27). Для спектатора в запросе передаётся позиция камеры (`spectatorCam`), которая задаёт `localX/localY` и обёртку мира вокруг текущего вида.
   - Вычисляет сплайны змеек ([SplineComputer.computeSplinePaths](frontend/src/worker/SplineComputer.ts#L14)), строит буферы геометрии ([MeshBuilder.appendSnakeMesh](frontend/src/worker/MeshBuilder.ts#L15)), вычисляет позиции глаз (`eyes.addEyes`), симулирует частицы (`ParticleComputer`). Координаты клеток переводятся в world через `gridToWorldX/Y` из [WorldMath.ts](frontend/src/worker/shared/WorldMath.ts); torus-операции — только через [MathUtils.ts](frontend/src/worker/shared/MathUtils.ts).
   - Преобразует данные в плоские типизированные массивы `Float32Array` и `Uint32Array` (буферы вершин, индексов, матриц инстансов).
   - **Формат границы:** Сообщение `FRAME_DATA` с набором типизированных массивов в качестве `Transferable Objects` и тем же `requestId`; при отсутствии состояния отправляется `FRAME_UNAVAILABLE`.

7. **Main Thread / Game.ts:**
   - `NetworkManager` присваивает каждому `REQUEST_FRAME` монотонный `requestId` и принимает только ответ с совпадающим id (ответ без id — legacy). После 100 мс ожидания кадр считается потерянным; 30 таймаутов подряд трактуются как stall и запускают worker watchdog (до 3 рестартов с backoff).
   - Получает `FRAME_DATA` в `handleWorkerMessage`, сбрасывает `isWaitingForFrame` и сохраняет кадр в `latestFrame`.
   - В `requestAnimationFrame` тике вызывает `RenderOrchestrator.updateAndRender`; при потере WebGL-контекста останавливает rAF и показывает `GameErrorOverlay`, а после восстановления контекста снимает overlay и перезапускает rAF без reload.

8. **RenderOrchestrator & Renderers (Рендер):**
   - [RenderOrchestrator](frontend/src/game/RenderOrchestrator.ts) обновляет камеру и вызывает методы `update` у всех рендереров.
   - [SnakeRenderer](frontend/src/renderer/SnakeRenderer.ts), [FoodRenderer](frontend/src/renderer/FoodRenderer.ts), [PortalRenderer](frontend/src/renderer/PortalRenderer.ts), [BlackHoleRenderer](frontend/src/renderer/BlackHoleRenderer.ts), [ParticleRenderer](frontend/src/renderer/ParticleRenderer.ts) обновляют геометрии Three.js (`BufferGeometry`) и матрицы инстансов (`InstancedMesh`) на основе полученных буферов.
   - [SceneManager.render](frontend/src/renderer/SceneManager.ts) выполняет отрисовку через [PostProcessing.render](frontend/src/renderer/PostProcessing.ts) (tone mapping, bloom, линзирование чёрных дыр и atmosphere grade). Пресет качества (`RenderQuality`) задаёт эффекты, тени, contact shadow, плотность декора и pixel ratio; в режиме `auto` [AdaptiveResolution](frontend/src/renderer/AdaptiveResolution.ts) плавно меняет pixel ratio по GPU time через `EXT_disjoint_timer_query_webgl2` (одна in-flight query, новый сэмпл примерно раз в два кадра), а при отсутствии extension или молчании дольше 5 с (watchdog) переключается на frame-time fallback, продолжая GPU-probe.
   - Свет/тени вынесены в [SceneLighting](frontend/src/renderer/SceneLighting.ts) (hemisphere/key/fill rig, snake-light pool, shadow map), земля — в [GroundPlane](frontend/src/renderer/GroundPlane.ts), туман — в [FogOverlay](frontend/src/renderer/FogOverlay.ts) (aerial fog и круговой ground overlay). `SceneManager` остаётся оркестратором renderer/composer/contact shadow/adaptive resolution/context lifecycle и ре-экспортирует прежние константы освещения и тумана.
   - **Context lifecycle:** `SceneManager` слушает `webglcontextlost`/`webglcontextrestored` на canvas. Loss делает `preventDefault`, ставит флаг, останавливает `render()` и уведомляет `onContextLost`; restore пересобирает только собственные GPU-ресурсы (renderer state, shadow map, composer/bloom/contact-shadow targets, `GpuTimer`) и уведомляет `onContextRestored` — Three сам пересоздаёт свои program/attribute/property кэши и заново загружает geometry/texture при следующей отрисовке. Подписан только player-route: `Game` по loss останавливает rAF и держит overlay, по restore снимает его и перезапускает `tick()` (поэтому throttle-счётчик `document.body.dataset.gameFrames` продолжает расти); spectator (`SpectatorApp`) не подписан, его rAF не останавливается, а `render()` сам early-return'ит на время loss, так что после restore рендер продолжается без overlay. Если rebuild бросил исключение, флаг остаётся взведённым и player не возобновляет loop (остаётся overlay с reload).

---

### 2. Поток ввода: Ввод → Предсказание → Сервер

Цепочка движения команд от действий пользователя до обработки на сервере:

```
[InputManager] (Events)
       │
       ▼ (turn [-1, 1], accelerating [bool])
[Game.ts] (Input Update)
       │
       ▼ (Строковые команды LEFT_DOWN / TURN:<val> / SPACE_DOWN)
[NetworkManager -> Web Worker (worker.ts)]
       │
       ├─► [CameraPredictor] (Мгновенное предсказание локального игрока)
       │
       ▼ (Отправка сырой строки)
[WebSocketClient]
       │
       ▼ (Сеть: текстовые WS фреймы)
[FastAPI Server (websocket.py)]
       │
       ▼ (Проверка лимитов и запись в Player)
[GameState.players]
       │
       ▼ (Следующий серверный тик)
[physics.py] (Обновление угла и позиции)
```

**Детализация шагов и форматы данных:**
1. **InputManager (Клиент):**
   - Слушает события `keydown`/`keyup` (клавиатура), `mousemove` (мышь), `deviceorientation` (гироскоп), `touchstart`/`touchmove`/`touchend` (тач).
   - Сначала проверяет `isEditableTarget` (поля ввода, `contenteditable`, `.hud-interactive`) и состояние открытого UI; только потом вызывает `preventDefault`/`stopPropagation`. `resyncInput()` сбрасывает накопленное состояние при respawn/reconnect, не теряя ещё зажатые клавиши.
   - Вычисляет значение поворота `turn` в диапазоне `[-1.0, 1.0]` и флаг ускорения `accelerating`.
   - **Формат границы:** Вызов коллбеков `onInputUpdate` и `onControlModeChange`.

2. **Game.ts (Клиент):**
   - Получает уведомления от `InputManager`.
   - В режиме `keyboard` отправляет строковые команды: `"LEFT_DOWN"`, `"LEFT_UP"`, `"RIGHT_DOWN"`, `"RIGHT_UP"`, `"SPACE_DOWN"`, `"SPACE_UP"`.
   - В режимах `mouse`/`tilt` отправляет команду `"TURN:<value>"` (с точностью до 3 знаков после запятой, например, `"TURN:0.425"`), сглаживая и дросселируя отправку: не чаще раза в 40 мс, при изменении > 0.01 или при snap-to-zero. После respawn/reconnect отправляется полный snapshot текущего ввода.
   - **Формат границы:** Сообщения воркеру `{ type: "SEND", data: string }`; `RESYNC` как игровой ввод не отправляется.

3. **CameraPredictor (Воркер):**
   - На каждом локальном запросе кадра (`REQUEST_FRAME`), используя значения локального ввода, мгновенно предсказывает позицию игрока (`localX`, `localY`) и угол наклона камеры (`localAngle`) для сглаживания движения камеры до получения подтверждения от сервера.
   - Для спектатора игрока нет: `localX/localY` берутся из переданной позиции `SpectatorCamera`, чтобы обёртка сущностей и follow-камера работали от текущего вида, а не от центра карты.

4. **WebSocketClient (Воркер):**
   - Пересылает текстовые команды без изменений в WebSocket; `SEND` со строкой `RESYNC` отбрасывается, чтобы control-сообщение нельзя было отправить как input.
   - **Формат границы:** Текстовый фрейм WebSocket (UTF-8 строка).

5. **websocket.py (Сервер):**
   - Handshake уже аутентифицирован по HttpOnly cookie `player_session`; `role` определяет player/spectator cap, а `client_id` из query игнорируется.
   - Принимает текстовые сообщения, проверяет размер (игнорирует > 32 символов). `RESYNC` обрабатывается до игрового парсинга: `needs_full_sync=True`, дренаж очереди, cooldown 1 с.
   - Выполняет rate limiting (максимум 50 команд в секунду на соединение).
   - Команды `"TURN:..."` парсятся во float и устанавливают флаг `steered_by_mouse = True`.
   - Клавишные команды устанавливают `turn = -1 / 1 / 0` и сбрасывают `steered_by_mouse = False`.
   - Команды пробела переключают `accelerating = True / False`.
   - Состояние сохраняется непосредственно в объекте игрока [Player](backend/app/engine/entities.py#L68) в `GameState.players`.

6. **Physics System (Сервер):**
   - На следующем тике система [physics.py](backend/app/engine/systems/physics.py) считывает `player.turn` или `player.angle` и перемещает змейку в пространстве.

---

## Критические зависимости

В проекте есть жестко связанные пары и группы файлов. Изменение одного из них без синхронного обновления другого приведет к критическим ошибкам:

1. **Тороидальная математика:**
   - **Файлы:** [MathUtils.ts](frontend/src/worker/shared/MathUtils.ts) и [math_utils.py](backend/app/engine/systems/math_utils.py)
   - **Что сломается:** Предсказание позиции и углов на клиенте разойдется с реальным движением на сервере. Камера начнёт дёргаться при пересечении границ карты, а сплайны змеек будут рассчитываться неверно, вызывая визуальные разрывы геометрии.
   - **Причина:** Дублирование wrap-логики (`wrapNearest`/`wrapDelta` ↔ `wrap_coordinate`/`wrap_delta`, `toroidalDelta` ↔ `toroidal_delta`). Обе реализации обязаны совпадать с `tests_shared/golden_vectors/math.json`.

2. **Сетка и world-координаты:**
   - **Файлы:** [Config.ts](frontend/src/game/Config.ts), [WorldMath.ts](frontend/src/worker/shared/WorldMath.ts), [game_config.py](backend/game_config.py)
   - **Что сломается:** Порталы, чёрные дыры, еда, надгробия и камера разъедутся на полклетки; fog/AoI перестанет совпадать с серверным.
   - **Причина:** `gridSize = 20` и `CELL_SIZE = 10.0` — разные единицы. Серверные позиции приходят в grid-единицах, клиент обязан переводить их только через `gridToWorldX/Y` (`grid * gridSize + gridSize / 2`, инверсия Y), а размеры карты брать из `server_world`, не из хардкода. Скорости, углы и tick rate приходят в `server_simulation`.

3. **Сериализация и декодирование сетевого кадра:**
   - **Файлы:** [serialization.py](backend/app/engine/systems/serialization.py), [ProtoFrameDecoder.ts](frontend/src/worker/shared/ProtoFrameDecoder.ts), [DeltaDecoder.ts](frontend/src/worker/DeltaDecoder.ts), `tests_shared/snake.proto`.
   - **Что сломается:** Декомпрессия или декодирование Protobuf-пакета упадёт с ошибкой, клиент не сможет обработать ни один кадр и игра зависнет на экране загрузки. Неверная truth table даст дыры в теле, ложные `length=1` или потерянные головы far-player'ов.
   - **Причина:** Схема `snake.proto`, поля `body`/`new_heads`/`length`/`body_truncated`/`final_length`/`frame_seq`/`server_tick` и head-first порядок жёстко закодированы на обеих сторонах. Любое изменение формата требует regenerate `snake_pb2.py` и новых golden-фикстур.
   - **Проверка:** `test_frame_parity.py`, `DeltaDecoder.parity.test.ts`, `test_math_parity.py`, `MathUtils.parity.test.ts`; `.bin` — транспортная фикстура, эталон — несжатый deterministic protobuf.

4. **Конфиг и live-state:**
   - **Файлы:** [game_config.py](backend/game_config.py), [config_schema.py](backend/app/api/config_schema.py), [state.py](backend/app/engine/state.py), [config.example.json](backend/config.example.json), [docker-entrypoint.sh](backend/docker-entrypoint.sh).
   - **Что сломается:** Pydantic-схема разойдётся с dataclass'ами, live-игроки останутся на старом `config`, а транзакционный rollback не восстановит сетку/формулы/ботов. В Docker пустой volume засеется не тем шаблоном или entrypoint перезапишет live-файл.
   - **Причина:** `AdminConfigPatch` генерируется из `GameConfig`, `World.update_config` делает validate → apply → backup/write, а `config.example.json` и `config.schema-version` — единственные tracked-артефакты схемы.

5. **Граница main ↔ worker:**
   - **Файлы:** [WorkerProtocol.ts](frontend/src/worker/shared/WorkerProtocol.ts), [worker.ts](frontend/src/worker/worker.ts), [NetworkManager.ts](frontend/src/game/NetworkManager.ts).
   - **Что сломается:** `typecheck` поймает несовпадение полей, но runtime-обмен (`CONNECT`/`SEND`/`REQUEST_FRAME`/`FRAME_DATA`/`FRAME_UNAVAILABLE`) может потерять `requestId` или spectator-камеру.
   - **Причина:** Это единственный типизированный контракт границы; `requestId`-корреляция и `FrameContext` не должны дублироваться вручную.

---

## Инварианты

Условия, которые гарантированно соблюдаются в коде:

1. **Интерполяция:**
   - [StateInterpolator.pushState](frontend/src/worker/StateInterpolation.ts#L9) ограничивает очередь 20 состояниями. Таймлайн сглаживается low-pass фильтром, snap при дрейфе > 200 мс, целевая задержка — 3 тика.
2. **Лимиты инстансов WebGL:**
   - `FoodRenderer` — `5000`, `PortalRenderer`/`BlackHoleRenderer` — `100`, `ParticleRenderer` — `2000`, `SnakeRenderer` — `1000` голов/глаз, `TombstoneRenderer` — `50`.
   - `GrassRenderer` использует бюджет пресета и общий cap `DECOR_BUDGET_CAPS.grass`; камни и трава не участвуют в коллизиях.
3. **Лимит чёрных дыр для lensing:**
   - [PostProcessing.ts](frontend/src/renderer/PostProcessing.ts#L24) передаёт максимум `10` чёрных дыр в `uBlackHoles[10]`.
4. **Сетевые лимиты и identity:**
   - [websocket.py](backend/app/api/websocket.py) до создания identity проверяет точный Origin allowlist (`ALLOWED_ORIGINS`), per-IP bucket (`WS_HANDSHAKE_RATE_LIMIT=30` за `WS_HANDSHAKE_WINDOW_SECONDS=10`) и role caps. `TRUST_PROXY_HEADERS` разрешает forwarding-заголовки только за доверенным proxy; WS берёт `X-Real-IP` или первый `X-Forwarded-For`, admin login — только `X-Real-IP`.
   - Role caps: `MAX_PLAYER_CONNECTIONS=50`, `MAX_SPECTATOR_CONNECTIONS=100`. Takeover существующего игрока слот не расходует; spectator flood не занимает player-лимит. Граница — атомарный pending reservation (`active + pending < limit`) до `accept()`, затем `_claim_connection` переводит резерв в active. Отказы: `1008` (Origin), `4002` (player), `4003` (spectator), `4029` (per-IP).
   - Игровая identity — HttpOnly cookie `player_session` (TTL 30 дней, cap 10 000, rate limit 30/мин на IP). `client_id` из query игнорируется; spectator всегда получает новый UUID и не резолвит player-cookie.
   - Rate limit входящих сообщений — `50/с` на соединение. `permessage-deflate` выключен, `ws_max_size=4096`, клиентские команды ≤ `32` байт. `RESYNC` имеет серверный cooldown `1 с` и не считается игровым вводом.
   - Sender-очередь — один слот; `REPLACED_DELTA` запускает FULL, `REPLACED_FULL`/`DROPPED_DELTA_FULL_PENDING` не создают FULL-шторм. Сбой sender закрывает socket кодом `1011`.
5. **Сетка и world-единицы:**
   - Серверный spatial grid использует `CELL_SIZE = 10.0`; клиентский `gridSize = 20`. Серверные координаты — grid-единицы, world = `grid * gridSize`, fog/AoI = `world / gridSize`. Позиции клеток переводятся только через `WorldMath` (`gridToWorldX/Y` с half-cell), torus-wrap — только через `MathUtils`/`math_utils`.
6. **Идентичность spectator/player:**
   - Spectator всегда получает собственный `client_id`; идентификатор игрока никогда не переиспользуется для спектатора. Иначе открытие спектатора рвёт соединение игрока и оставляет змейку-призрака.
7. **Обновление чёрных дыр:**
   - Таймеры, рост и смена состояний обновляются ровно один раз за тик в `game.py`; `gravity.py` применяет только притяжение и проверку гибели.
8. **Один player-сеанс на браузер:**
   - Player-вкладка держит Web Lock `snake-player-session` с момента Play. Вторая вкладка не подключается, а предлагает takeover или spectator; takeover идёт через `BroadcastChannel`, старая вкладка останавливает игру, освобождает лок и показывает «Сессия перенесена». Identity хранится в server-side HttpOnly cookie `player_session`, поэтому takeover сохраняет ту же сессию и сервер видит reconnect той же змейки; `snake_client_id` больше не используется и очищается. Без Web Locks (не secure context) поведение откатывается к прежнему.
9. **Кадры и тело:**
   - `frame_seq`/`server_tick` увеличиваются один раз за тик после систем; FULL/DELTA/config broadcast одного тика несут одинаковый seq, `reset_state()` сбрасывает оба. `FrameSequencer` принимает только `lastSeq + 1` (uint32), разрыв → `RESYNC`.
   - Тело — плоский `[x0, y0, ...]` head-first; сервер разворачивает `new_heads_this_tick` после тика. Truth table: alive+in-AoI — полное тело; alive+out-AoI — `length=1` + `body_truncated`; dead — пустое тело, `length=0`, `final_length`. `getNewBody` клампит длину до восстановимого размера.
10. **Конфиг и runtime volume:**
    - `World.update_config` делает validate → apply → backup/rollback, пишет `config.json` атомарно (`os.replace`, fallback для single-file mount) и возвращает 400/503 на admin-маршруте. Docker использует named volume `backend_config` в `/app/data`; entrypoint сеет `config.example.json` только в пустой volume и не перезаписывает live-файл/`.bak`. `config.schema-version` — отдельный файл, а не поле JSON.
11. **События тика и reset:**
    - Удаления игроков идут через `pending_removals` и применяются в начале тика до систем; `reset_state()` очищает pending removals, spectators, input queue, tombstones и per-tick caches.
12. **Админ-доступ:**
    - `POST /admin/login` выдаёт серверную HttpOnly cookie `admin_token` (SameSite=Strict, TTL 12 ч); `require_admin` проверяет сессию. Пароль не хранится в `localStorage` и не передаётся в custom headers. Login/config/restart пишут audit-запись без секретов и значений конфига.
13. **Liveness и readiness:**
    - `/health` и `/ws/health` всегда `200 {"status":"ok"}` и не зависят от игры. `/ready` и `/ws/ready` отдают tick-метрики и `503` при `tick_age > max(2.0, tick_interval * 5)`; heartbeat двигает только успешный тик.
14. **Граница worker:**
    - `requestId` монотонен и не сбрасывается на reconnect; `FRAME_DATA`/`FRAME_UNAVAILABLE` принимаются только с текущим id. 30 подряд 100-мс таймаутов → stall, до 3 рестартов worker с backoff, затем фатальный overlay.
