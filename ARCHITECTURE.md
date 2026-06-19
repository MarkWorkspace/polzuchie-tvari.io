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
       ▼ (Парсинг точек [x0, y0, ...] -> Point[])
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
   - На каждом тике (30 Гц) оркестратор [game.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/game.py) вызывает физические и игровые системы, обновляющие состояние [GameState](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/state.py).
   - [serialization.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/serialization.py) кэширует сериализованные словари игроков и собирает `GameStateFrame` по схеме `tests_shared/snake.proto`. Для экономии трафика координаты змеек сжимаются в плоские одномерные массивы `[x0, y0, x1, y1, ...]`.
   - В [server.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/server.py) полученный Protobuf-кадр сжимается с помощью `zlib.compress(..., level=1)`.
   - **Формат границы:** Бинарный сжатый Protobuf (zlib/deflate).

2. **WebSocket Connection (Сеть):**
   - Передача через WebSocket в бинарном режиме (`arraybuffer`).

3. **WebSocketClient (Воркер):**
   - Получает `arraybuffer` в `_handleMessage`.
   - Передает в [DeltaDecoder.decompress()](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/DeltaDecoder.ts#L5), который использует `pako.inflate`.
   - Декодирует распакованный буфер с помощью минимального [ProtoFrameDecoder.ts](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/shared/ProtoFrameDecoder.ts).
   - **Формат границы:** JS Object с сырыми сетевыми данными.

4. **DeltaDecoder (Воркер):**
   - Метод `decodeFullState` / `decodeDeltaState` конвертирует плоские массивы координат обратно в структуры вида `Point[]` (`{x, y}`).
   - Фильтрует еду по границам карты и кэширует ее в `foodMap`.
   - Возвращает структурированный `GameState` объект.

5. **StateInterpolator (Воркер):**
   - Помещает новое состояние в очередь `queue` (максимум 20 элементов).
   - При запросе кадра вычисляет интерполированное состояние между последними двумя тиками на основе таймингов.

6. **FrameComputer & SnakeProcessor (Воркер):**
   - По запросу `REQUEST_FRAME` от главного потока воркер вызывает `computeFrame`.
   - Выполняет предсказание локального игрока с помощью [CameraPredictor.predict](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/CameraPredictor.ts#L27).
   - Вычисляет сплайны змеек ([SplineComputer.computeSplinePaths](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/SplineComputer.ts#L14)), строит буферы геометрии ([MeshBuilder.appendSnakeMesh](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/MeshBuilder.ts#L15)), вычисляет позиции глаз (`eyes.addEyes`), симулирует частицы (`ParticleComputer`).
   - Преобразует данные в плоские типизированные массивы `Float32Array` и `Uint32Array` (буферы вершин, индексов, матриц инстансов).
   - **Формат границы:** Сообщение `FRAME_DATA` с набором типизированных массивов в качестве `Transferable Objects` для исключения сборки мусора (GC).

7. **Main Thread / Game.ts:**
   - Получает сообщение `FRAME_DATA` в `handleWorkerMessage`, сбрасывает флаг `isWaitingForFrame = false` и сохраняет кадр в `latestFrame`.
   - В `requestAnimationFrame` тике вызывает `RenderOrchestrator.updateAndRender`.

8. **RenderOrchestrator & Renderers (Рендер):**
   - [RenderOrchestrator](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/game/RenderOrchestrator.ts) обновляет камеру и вызывает методы `update` у всех рендереров.
   - [SnakeRenderer](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/SnakeRenderer.ts), [FoodRenderer](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/FoodRenderer.ts), [PortalRenderer](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/PortalRenderer.ts), [BlackHoleRenderer](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/BlackHoleRenderer.ts), [ParticleRenderer](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/ParticleRenderer.ts) обновляют геометрии Three.js (`BufferGeometry`) и матрицы инстансов (`InstancedMesh`) на основе полученных буферов.
   - [SceneManager.render](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/SceneManager.ts#L81) выполняет отрисовку через [PostProcessing.render](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/PostProcessing.ts#L88) (шейдер линзирования черных дыр и тумана) или напрямую через WebGLRenderer.

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
   - Вычисляет значение поворота `turn` в диапазоне `[-1.0, 1.0]` и флаг ускорения `accelerating`.
   - **Формат границы:** Вызов коллбеков `onInputUpdate` и `onControlModeChange`.

2. **Game.ts (Клиент):**
   - Получает уведомления от `InputManager`.
   - В режиме `keyboard` отправляет строковые команды: `"LEFT_DOWN"`, `"LEFT_UP"`, `"RIGHT_DOWN"`, `"RIGHT_UP"`, `"SPACE_DOWN"`, `"SPACE_UP"`.
   - В режимах `mouse`/`tilt` отправляет команду `"TURN:<value>"` (с точностью до 3 знаков после запятой, например, `"TURN:0.425"`), сглаживая и дросселируя отправку (не чаще раза в 50 мс или при изменении > 0.05).
   - **Формат границы:** Сообщения воркеру `{ type: "SEND", data: string }`.

3. **CameraPredictor (Воркер):**
   - На каждом локальном запросе кадра (`REQUEST_FRAME`), используя значения локального ввода, мгновенно предсказывает позицию игрока (`localX`, `localY`) и угол наклона камеры (`localAngle`) для сглаживания движения камеры до получения подтверждения от сервера.

4. **WebSocketClient (Воркер):**
   - Пересылает текстовые команды без изменений в WebSocket.
   - **Формат границы:** Текстовый фрейм WebSocket (UTF-8 строка).

5. **websocket.py (Сервер):**
   - Принимает текстовые сообщения, проверяет размер (игнорирует > 20 символов).
   - Выполняет rate limiting (максимум 30 команд в секунду).
   - Команды `"TURN:..."` парсятся во float и устанавливают флаг `steered_by_mouse = True`.
   - Клавишные команды устанавливают `turn = -1 / 1 / 0` и сбрасывают `steered_by_mouse = False`.
   - Команды пробела переключают `accelerating = True / False`.
   - Состояние сохраняется непосредственно в объекте игрока [Player](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/entities.py#L68) в `GameState.players`.

6. **Physics System (Сервер):**
   - На следующем тике система [physics.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/physics.py) считывает `player.turn` или `player.angle` и перемещает змейку в пространстве.

---

## Критические зависимости

В проекте есть жестко связанные пары и группы файлов. Изменение одного из них без синхронного обновления другого приведет к критическим ошибкам:

1. **Тороидальная математика:**
   - **Файлы:** [MathUtils.ts](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/shared/MathUtils.ts) и [math_utils.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/math_utils.py)
   - **Что сломается:** Предсказание позиции и углов на клиенте разойдется с реальным движением на сервере. Камера начнет дергаться при пересечении границ карты, а сплайны змеек будут рассчитываться неверно, вызывая визуальные разрывы геометрии.
   - **Причина:** Дублирование логики тороидального расстояния и смещения (`toroidalDelta` / `toroidal_delta`).

2. **Сетевые константы физики:**
   - **Файлы:** [Config.ts](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/game/Config.ts) и [game_config.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/game_config.py)
   - **Что сломается:** Рассинхронизация клиентского предсказания камеры и движения.
   - **Причина:** Константы скорости (`BASE_SPEED_PER_SECOND`), углов поворота (`MAX_TURN_SPEED_DEG`) и размеров сетки (`gridSize` / `CELL_SIZE`) продублированы и должны совпадать.

3. **Сериализация и декодирование сетевого кадра:**
   - **Файлы:** [DeltaDecoder.ts](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/DeltaDecoder.ts) и [serialization.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/serialization.py)
   - **Что сломается:** Декомпрессия или декодирование Protobuf-пакета упадет с ошибкой, клиент не сможет обработать ни один кадр и игра зависнет на экране загрузки.
   - **Причина:** Схема `tests_shared/snake.proto` и формат плоских массивов координат `body`/`new_heads` жестко закодированы на обеих сторонах.

---

## Инварианты

Условия, которые гарантированно соблюдаются в коде:

1. **Размер очереди интерполяции:**
   - [StateInterpolator.pushState](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/worker/StateInterpolation.ts#L9) всегда ограничивает размер очереди `this.queue` максимум 20 состояниями. При превышении старые состояния удаляются (`this.queue.shift()`).
2. **Лимиты инстансов WebGL:**
   - `FoodRenderer` жестко ограничен `5000` инстансами (`maxInstances = 5000`), пакеты воркера обрезают еду свыше этого лимита.
   - `PortalRenderer` и `BlackHoleRenderer` ограничены `100` инстансами.
   - `ParticleRenderer` (эффекты ускорения) ограничен `2000` инстансами.
   - `SnakeRenderer` (для глаз и зрачков) имеет жесткий лимит в `2000` инстансов (`1000` змеек).
3. **Лимит черных дыр для lensing-эффекта:**
   - В [PostProcessing.ts](file:///c:/Users/Engineer/Desktop/snake%20AI/frontend/src/renderer/PostProcessing.ts#L119) вычисления lensing-эффекта проводятся максимум для `10` черных дыр (соответствует размеру массива `uBlackHoles[10]` в шейдере `lensingMaterial`).
4. **Сетевые лимиты:**
   - [websocket.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/api/websocket.py#L19) ограничивает количество одновременных подключений до `50` (`MAX_CONNECTIONS`).
   - Rate limiting входящих сообщений от одного WebSocket-клиента равен `30` сообщений в секунду.
   - Максимальная длина ника игрока — `16` символов, некорректные скины принудительно сбрасываются в `"#22c55e"`.
5. **Тороидальный размер ячеек:**
   - Spatial partitioning на сервере ([collision.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/collision.py#L5), [food_eating.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/food_eating.py#L5), [gravity.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/gravity.py#L33), [serialization.py](file:///c:/Users/Engineer/Desktop/snake%20AI/backend/app/engine/systems/serialization.py#L7)) и клиенте использует фиксированный размер ячейки `CELL_SIZE = 10.0`.
