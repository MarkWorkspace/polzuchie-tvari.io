# PROJECT_MAP.md

> Этот файл поддерживается AI-агентами. Обновляется после каждого структурного изменения.
> Правила обновления — в `AGENTS.md`

---

## Frontend: `frontend/`

```
frontend/
├── index.html
├── vite.config.ts
├── package.json
├── Dockerfile                      # ROLE: Сборка и запуск фронтенда (Vite) в Docker.
└── src/
    ├── main.ts                         # ROLE: Точка входа приложения. Не содержит игровой логики.
    ├── game/
    │   ├── Game.ts                     # ROLE: Жизненный цикл приложения: init/update/destroy. Не содержит рендеринг.
    │   ├── RenderOrchestrator.ts       # ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены. Не содержит логики ввода или сети.
    │   ├── InputManager.ts             # ROLE: Ввод с клавиатуры, мыши, тача, гироскопа. Не UI, не сеть.
    │   ├── NetworkManager.ts           # ROLE: WebSocket-интерфейс к воркеру. Не бизнес-логика.
    │   ├── Camera.ts                   # ROLE: Следование камеры, зум. Не рендеринг.
    │   └── Config.ts                   # ROLE: Клиентские константы рендеринга. Не содержит физические константы.
    ├── lib/
    │   └── i18n.ts                     # ROLE: Локализация текстов интерфейса (RU/EN). Не содержит игровую логику.
    ├── renderer/
    │   ├── SceneManager.ts             # ROLE: Инициализация Three.js сцены, свет, рендерер.
    │   ├── SnakeRenderer.ts            # ROLE: Меши змеек, сплайны, тени. Не физика, не HUD.
    │   ├── NicknameRenderer.ts         # ROLE: Отображение 2D HTML никнеймов над головами змеек. Не трехмерный рендеринг, не HUD.
    │   ├── FoodRenderer.ts             # ROLE: Инстансированные меши еды.
    │   ├── CherryGeometry.ts           # ROLE: Процедурная генерация 3D-геометрии вишни. Не содержит инстансинга и рендеринга.
    │   ├── PeachGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии персика. Не содержит инстансинга и рендеринга.
    │   ├── StrawberryGeometry.ts       # ROLE: Процедурная генерация 3D-геометрии клубники. Не содержит инстансинга и рендеринга.
    │   ├── PineappleGeometry.ts        # ROLE: Процедурная генерация 3D-геометрии ананаса. Не содержит инстансинга и рендеринга.
    │   ├── AppleGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии яблока. Не содержит инстансинга и рендеринга.
    │   ├── WatermelonGeometry.ts       # ROLE: Процедурная генерация 3D-геометрии арбуза для FoodRenderer.
    │   ├── GrapeGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии винограда. Не содержит инстансинга и рендеринга.
    │   ├── PortalRenderer.ts           # ROLE: Визуализация порталов.
    │   ├── BlackHoleRenderer.ts        # ROLE: Визуализация чёрных дыр.
    │   ├── ParticleRenderer.ts         # ROLE: Система частиц (свечение хвоста).
    │   ├── PostProcessing.ts           # ROLE: Линзирование, туман.
    │   ├── DebugRenderer.ts            # ROLE: Отрисовка отладочной сетки и коллизий в режиме debug.
    │   └── shaders/
    │       ├── snakeBody.glsl.ts       # ROLE: Шейдер тела змейки (5 скинов, GPU-клиппинг).
    │       ├── food.glsl.ts            # ROLE: Шейдер еды.
    │       ├── portal.glsl.ts          # ROLE: Шейдер портала.
    │       ├── blackHole.glsl.ts       # ROLE: Шейдер чёрной дыры.
    │       └── ground.glsl.ts          # ROLE: Шейдер бесконечного пола с сеткой и туманом.
    ├── worker/
    │   ├── worker.ts                   # ROLE: Точка входа воркера, onmessage-роутер. Не содержит вычислений.
    │   ├── StateInterpolation.ts       # ROLE: Очередь состояний, интерполяция между тиками.
    │   ├── SplineComputer.ts           # ROLE: Расчёт 3D-сплайнов змеек.
    │   ├── MeshBuilder.ts              # ROLE: Сборка vertex/index-буферов из сплайнов.
    │   ├── CameraPredictor.ts          # ROLE: Клиентское предсказание позиции камеры.
    │   ├── FoodComputer.ts             # ROLE: Матрицы и цвета инстансов еды.
    │   ├── PortalComputer.ts           # ROLE: Матрицы инстансов порталов.
    │   ├── BlackHoleComputer.ts        # ROLE: Матрицы инстансов чёрных дыр.
    │   ├── ParticleComputer.ts         # ROLE: Симуляция частиц хвоста.
    │   ├── EyeComputer.ts              # ROLE: Позиции глаз и зрачков змеек.
    │   ├── DeltaDecoder.ts             # ROLE: Декодирование delta-стейтов с сервера. Не сеть, не интерполяция.
    │   ├── DeltaDecoder.parity.test.ts # ROLE: Parity-тест сетевого кадра. Декодирует бинарные фикстуры и сравнивает с expected JSON.
    │   ├── WebSocketClient.ts          # ROLE: WebSocket-соединение, реконнект, ping/pong. Не бизнес-логика.
    │   ├── FrameComputer.ts            # ROLE: Сборка кадра игры (матрицы, вершины, лидерборд) для отправки на фронтенд.
    │   ├── SnakeProcessor.ts           # ROLE: Обработка сплайнов, мешей, глаз и частиц змеек на каждом кадре воркера. Не содержит рендеринг.
    │   └── shared/
    │       ├── MathUtils.ts            # ROLE: Тороидальные операции, lerp. ЕДИНСТВЕННАЯ копия математики на фронте.
    │       ├── MathUtils.parity.test.ts # ROLE: Parity-тест тороидальной математики. Сверяет TS с golden vectors.
    │       ├── GrowableArray.ts        # ROLE: Динамически расширяемые массивы Float32 и Uint32 для буферов геометрии.
    │       ├── ColorUtils.ts           # ROLE: parseColor, lerpColors, hslToHex.
    │       ├── ProtoFrameDecoder.ts    # ROLE: Минимальный Protobuf-декодер GameStateFrame для воркера. Не генерирует и не кодирует сообщения.
    │       ├── snake_proto.js          # ROLE: [СГЕНЕРИРОВАНО] JS-модуль Protobuf.
    │       └── snake_proto.d.ts         # ROLE: [СГЕНЕРИРОВАНО] TS-декларации для Protobuf-модуля.
    ├── ui/
    │   ├── LoginScreen.ts              # ROLE: Экран входа.
    │   ├── HUD.ts                      # ROLE: Score, ping, статус соединения. Не игровая логика.
    │   ├── Leaderboard.ts              # ROLE: Топ-10 таблица.
    │   ├── Minimap.ts                  # ROLE: 2D-радар на Canvas с частотой обновления экрана. Не UI, не ввод.
    │   ├── KillFeed.ts                 # ROLE: Лента убийств.
    │   ├── SteeringIndicator.ts        # ROLE: Шкала поворота мыши.
    │   ├── MobileControls.ts           # ROLE: Мобильные элементы управления.
    │   └── SettingsPanel.ts            # ROLE: Боковая панель настроек.
    ├── admin/
    │   ├── AdminPanel.ts               # ROLE: Точка входа панели администратора, оркестрация событий и здоровья сервера.
    │   ├── ConfigEditor.ts             # ROLE: Состояние и бизнес-логика конфигурации админ-панели. Без UI.
    │   ├── ConfigRenderer.ts           # ROLE: Генерация HTML для полей конфигурации и видов еды. Без состояния.
    │   ├── AdminDashboard.ts           # ROLE: Генерация HTML шаблона панели администратора и модальных окон.
    │   ├── FoodSimulator.ts            # ROLE: Canvas-симулятор распределения еды. Без UI.
    │   └── AdminLabels.ts              # ROLE: Метаданные (названия полей, единицы измерения, подсказки) для панели администратора.
    └── types/
        └── game.ts                     # ROLE: Типы GameState, Player, Food и др. Только типы, без логики.

styles/
├── main.css
├── hud_score.css
├── hud.css
├── login.css
├── admin.css
├── minimap.css
└── settings.css
```

---

## Backend: `backend/`

```
backend/
├── server.py                           # ROLE: Точка входа FastAPI. Не содержит игровой логики.
├── game_config.py                      # ROLE: Конфигурация через датаклассы.
├── config.json                         # Сохранённая конфигурация (генерируется, не редактировать вручную).
├── requirements.txt                    # ROLE: Runtime-зависимости backend-сервера. Не содержит тестовые и генераторные инструменты.
├── requirements-dev.txt                # ROLE: Dev/test-зависимости backend. Расширяет runtime requirements для pytest и генерации Protobuf.
└── app/
    ├── api/
    │   ├── websocket.py                # ROLE: WebSocket endpoint, rate limiting. Не игровая логика.
    │   └── admin.py                    # ROLE: Admin REST API.
    └── engine/
        ├── game.py                     # ROLE: Оркестратор тика — только вызывает системы по порядку. Не содержит игровой логики.
        ├── state.py                    # ROLE: Контейнер игрового состояния, загрузка конфигурации, управление игроками. Не содержит игровой логики тика.
        ├── entities.py                 # ROLE: Датаклассы Player, Food, Portal, BlackHole. Только структуры данных.
        ├── food_manager.py             # ROLE: Жизненный цикл еды, кластеры, спавн.
        ├── world_elements.py           # ROLE: Жизненный цикл порталов и чёрных дыр.
        └── systems/
            ├── physics.py              # ROLE: Движение, тороидальное оборачивание. Не коллизии.
            ├── collision.py            # ROLE: Столкновения змейка-змейка (коэфф. 0.95). Не движение, не еда.
            ├── teleportation.py        # ROLE: FSM телепортации (5 состояний).
            ├── gravity.py              # ROLE: Притяжение чёрных дыр.
            ├── food_eating.py          # ROLE: Поедание и притяжение еды.
            ├── boost.py                # ROLE: Ускорение, потеря массы, спавн еды при бусте.
            ├── growth.py               # ROLE: Рост/усыхание, формула сегментов.
            ├── math_utils.py           # ROLE: toroidal_delta, toroidal_distance. ЕДИНСТВЕННАЯ копия математики на бэке.
            ├── serialization.py        # ROLE: Protobuf-упаковка, AoI-фильтрация.
            └── snake_pb2.py            # ROLE: [СГЕНЕРИРОВАНО] Python-модуль Protobuf.
```

---

## Тесты бэкенда: `backend/tests/`

```
backend/tests/
├── test_admin_auth.py                 # ROLE: Тесты Admin API аутентификации. Проверяет парсинг пароля, очистку пробелов/кавычек и работу login-обработчика.
├── test_admin_restart.py              # ROLE: Тесты Admin API restart-потока. Проверяет Protobuf restart-frame и очистку соединений.
├── test_collision.py                   # ROLE: Тесты столкновений змейка-змейка.
├── test_events.py                      # ROLE: Тесты EventBus.
├── test_formula_parser.py              # ROLE: Тесты парсера формул роста.
├── test_frame_parity.py                # ROLE: Round-trip parity-тест сетевого кадра. Кодирует → декодирует → сравнивает с .expected.json.
├── test_gravity.py                     # ROLE: Тестирование системы гравитации (притяжения еды).
├── test_gravity_once_per_tick.py        # ROLE: Тест: гравитация чёрных дыр применяется к углу змейки ровно один раз за тик.
├── test_growth.py                      # ROLE: Тесты роста/усыхания змейки.
├── test_math_parity.py                 # ROLE: Parity-тест тороидальной математики. Сверяет Python с golden vectors.
├── test_physics.py                     # ROLE: Тесты физики движения.
├── test_world_elements.py              # ROLE: Тесты порталов и чёрных дыр.
└── generate_frame_fixtures.py          # ROLE: Генерация эталонных кадров для parity-тестов. Запуск вручную при изменении формата.
```

---

## Общие тестовые данные: `tests_shared/`

```
tests_shared/
├── snake.proto                     # ROLE: Protobuf-схема сетевого протокола обмена.
├── golden_vectors/
│   └── math.json                       # Эталонные векторы для тороидальной математики (25 кейсов).
└── golden_frames/
    ├── frame_full.bin                  # Эталонный FULL-кадр (zlib + Protobuf).
    ├── frame_full.expected.json        # Ожидаемый результат декодирования FULL-кадра.
    ├── frame_delta.bin                 # Эталонный DELTA-кадр (zlib + Protobuf).
    └── frame_delta.expected.json       # Ожидаемый результат декодирования DELTA-кадра.
```

---

## CI: `.github/`

```
.github/
└── workflows/
    └── ci.yml                          # ROLE: CI для проекта. Запускает pytest и vitest на push/PR.
```
