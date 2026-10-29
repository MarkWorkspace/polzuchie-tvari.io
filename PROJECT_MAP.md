# PROJECT_MAP.md

> Этот файл поддерживается AI-агентами. Обновляется после каждого структурного изменения.
> Правила и рабочие команды — в `.opencode/instructions/project.md` (OpenCode V2).

---

## Repository root

```
.
├── README.md                           # ROLE: Quickstart, stack, checks and docs index.
├── .editorconfig                       # ROLE: Shared editor whitespace/charset conventions.
├── .gitattributes                      # ROLE: Line-ending and binary-file rules.
├── .pre-commit-config.yaml             # ROLE: Git hooks (Ruff/tests/build).
├── opencode.jsonc                      # ROLE: OpenCode V2 project config.
├── docker-compose.yml                  # ROLE: Local production-like stack.
├── start_dev.bat                       # ROLE: Windows dev launcher (uv + Vite).
└── scripts/run_checks.py               # ROLE: Cross-platform check runner used by hooks.
```

---

## Frontend: `frontend/`

```
frontend/
├── index.html
├── vite.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json                       # ROLE: Production TypeScript config (strict, excludes tests).
├── tsconfig.test.json                  # ROLE: Test TypeScript config (DOM + Node types).
├── biome.json                          # ROLE: Biome lint/format config for the frontend.
├── playwright.config.ts                # ROLE: Playwright E2E config; поднимает backend и Vite.
├── e2e/
│   ├── adminApi.ts                     # ROLE: Общие REST-хелперы Playwright для админ-конфига.
│   ├── game.spec.ts                    # ROLE: Smoke login, HUD и настроек качества.
│   ├── death.spec.ts                   # ROLE: Реальная смерть от чёрной дыры, game-over и respawn.
│   ├── bots.spec.ts                    # ROLE: Live-включение/выключение ботов через админку.
│   ├── spectator.spec.ts               # ROLE: Player- и debug-спектатор, follow по клику и возврат к обзору.
│   └── admin.spec.ts                   # ROLE: Smoke admin login/dashboard/logout.
├── .nvmrc                             # ROLE: Node.js version for the frontend toolchain (22).
├── Dockerfile                          # ROLE: Сборка и запуск фронтенда (Vite + nginx) в Docker.
├── nginx.conf                          # ROLE: SPA static serving, /ws proxy, cache and security headers.
├── public/
│   └── fonts/                          # ROLE: Self-hosted Outfit WOFF2 files.
└── src/
    ├── main.ts                         # ROLE: Route selection and lazy loading; no game logic.
    ├── game/
    │   ├── bootstrap.ts                # ROLE: Lazy game UI bootstrap (login, HUD, game lifecycle).
    │   ├── spectatorBootstrap.ts       # ROLE: Lazy spectator bootstrap; выбирает player-HUD или debug-панели.
    │   ├── spectatorMode.ts            # ROLE: Чистый разбор `?spectator=` / `?debug=` в player/debug режим.
    │   ├── spectatorMode.test.ts       # ROLE: Тесты маршрутизации player/debug-спектатора.
    │   ├── Game.ts                     # ROLE: Жизненный цикл приложения: init/update/destroy. Не содержит рендеринг.
    │   ├── RenderOrchestrator.ts       # ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены. Не содержит логики ввода или сети.
    │   ├── InputManager.ts             # ROLE: Ввод с клавиатуры, мыши, тача, гироскопа. Не UI, не сеть.
    │   ├── NetworkManager.ts           # ROLE: WebSocket-интерфейс к воркеру. Не бизнес-логика.
    │   ├── NetworkManager.test.ts      # ROLE: Тесты идентичности player/spectator и storage-ключей.
    │   ├── SpectatorApp.ts             # ROLE: Ядро спектатора: камера, сеть, рендер; debug UI вынесен отдельно.
    │   ├── SpectatorDebugOverlay.ts    # ROLE: Админские debug-панели спектатора (статы, выбор змейки).
    │   ├── SpectatorCamera.ts          # ROLE: Камера спектатора: free-pan/zoom и плавное слежение за игроком.
    │   ├── spectatorCameraMath.ts     # ROLE: Чистая тороидальная дельта для follow-камеры.
    │   ├── spectatorCameraMath.test.ts # ROLE: Тесты перехода камеры через границу карты.
    │   ├── Camera.ts                   # ROLE: Следование камеры, зум. Не рендеринг.
    │   └── Config.ts                   # ROLE: Клиентские константы рендеринга. Не содержит физические константы.
    ├── lib/
    │   ├── escapeHtml.ts               # ROLE: Escaping untrusted strings before HTML insertion.
    │   └── i18n.ts                     # ROLE: Локализация текстов интерфейса (RU/EN). Не содержит игровую логику.
    ├── renderer/
    │   ├── SceneManager.ts             # ROLE: Three.js сцена, hemisphere/key/fill свет, цветные snake-light'ы, тени, туман, пресеты качества и adaptive pixel ratio.
    │   ├── SnakeLightPool.ts           # ROLE: Пул из 3–4 головных PointLight для ближайших змей; без теней и геймплея.
    │   ├── SnakeLightPool.test.ts      # ROLE: Тест приоритета local player, лимита и очистки пула.
    │   ├── SnakeRenderer.ts            # ROLE: Меши змеек, emissive-скины, тени (depth-материал с тем же контуром) и skin-tinted head glow. Тело попадает в bloom-маску и contact-AO через отдельные слои. Не физика, не HUD.
    │   ├── AtmosphereEffect.ts         # ROLE: Дешёвый финальный grade: vignette, split-tone, saturation и dither. Без знания сцены.
    │   ├── NicknameRenderer.ts         # ROLE: Отображение 2D HTML никнеймов над головами змеек. Не трехмерный рендеринг, не HUD.
    │   ├── FoodRenderer.ts             # ROLE: Инстансированные меши еды.
    │   ├── CherryGeometry.ts           # ROLE: Процедурная генерация 3D-геометрии вишни. Не содержит инстансинга и рендеринга.
    │   ├── PeachGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии персика. Не содержит инстансинга и рендеринга.
    │   ├── StrawberryGeometry.ts       # ROLE: Процедурная генерация 3D-геометрии клубники. Не содержит инстансинга и рендеринга.
    │   ├── PineappleGeometry.ts        # ROLE: Процедурная генерация 3D-геометрии ананаса. Не содержит инстансинга и рендеринга.
    │   ├── AppleGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии яблока. Не содержит инстансинга и рендеринга.
    │   ├── WatermelonGeometry.ts       # ROLE: Процедурная генерация 3D-геометрии арбуза для FoodRenderer.
    │   ├── GrapeGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии винограда. Не содержит инстансинга и рендеринга.
    │   ├── MelonGeometry.ts            # ROLE: Процедурная генерация 3D-геометрии дыни.
    │   ├── MandarinGeometry.ts         # ROLE: Процедурная генерация 3D-геометрии мандарина.
    │   ├── PearGeometry.ts             # ROLE: Процедурная генерация 3D-геометрии груши.
    │   ├── PersimmonGeometry.ts        # ROLE: Процедурная генерация 3D-геометрии хурмы.
    │   ├── PortalRenderer.ts           # ROLE: Визуализация порталов.
    │   ├── BlackHoleRenderer.ts        # ROLE: Визуализация чёрных дыр.
    │   ├── TombstoneRenderer.ts        # ROLE: Инстансированные upright-надгробия: позиция, yaw, тени, emissive-подъём.
    │   ├── TombstoneGeometry.ts        # ROLE: Процедурная плита с аркой и основанием. Не рендерит и не анимирует.
    │   ├── TombstoneGeometry.test.ts   # ROLE: Тест габаритов/ориентации и наличия нормалей надгробия.
    │   ├── ParticleRenderer.ts         # ROLE: Мягкие additive-частицы хвоста (radial sprite без текстуры).
    │   ├── PostProcessing.ts           # ROLE: Bloom/SSAO/contact-AO/tone mapping в одном pass, bloom-маска по силуэтам светящихся объектов, линзирование ЧД отдельным pass, atmosphere grade.
    │   ├── SilhouetteRenderer.ts       # ROLE: Растеризует слой в маленький alpha-таргет (bloom-маска и contact-AO). Не свет, не пост-эффекты.
    │   ├── SilhouetteRenderer.test.ts  # ROLE: Тесты размера silhouette-таргета под pixel ratio и downscale.
    │   ├── RenderQuality.ts            # ROLE: Пресеты качества (auto/high/medium/low), shadow map и snake-light budget.
    │   ├── AdaptiveResolution.ts       # ROLE: Чистый сэмплер frame time → pixel ratio. Без DOM/WebGL.
    │   ├── AdaptiveResolution.test.ts  # ROLE: Тесты адаптивного разрешения.
    │   ├── RenderQuality.test.ts       # ROLE: Тесты пресетов качества и localStorage.
    │   ├── RenderConfig.ts             # ROLE: Слои отрисовки, overlay-layer для NormalPass, bloom-mask layer, фабрики материалов и glow-конверсия.
    │   ├── RenderConfig.test.ts        # ROLE: Тест перевода head_glow_radius из клеток в мировые единицы.
    │   ├── DebugRenderer.ts            # ROLE: Отрисовка отладочной сетки и коллизий в режиме debug.
    │   ├── DebugRenderer.test.ts       # ROLE: Тест кратности debug-буферов размеру атрибута.
    │   └── shaders/
    │       ├── snakeBody.glsl.ts       # ROLE: Шейдер плоской ленты: 5 скинов, sRGB→linear, emissive, контур.
    │       ├── snakeBody.glsl.test.ts  # ROLE: Тест точек patch'а тела (linear color, emissive, saturation).
    │       ├── food.glsl.ts            # ROLE: Шейдер еды.
    │       ├── portal.glsl.ts          # ROLE: Шейдер портала.
    │       ├── blackHole.glsl.ts       # ROLE: Шейдер чёрной дыры.
    │       └── ground.glsl.ts          # ROLE: Шейдер пола: AA-сетка, процедурная фактура и distance fade.
    ├── worker/
    │   ├── worker.ts                   # ROLE: Точка входа воркера, onmessage-роутер. Не содержит вычислений.
    │   ├── StateInterpolation.ts       # ROLE: Очередь состояний, интерполяция между тиками.
    │   ├── SplineComputer.ts           # ROLE: Расчёт 3D-сплайнов змеек.
    │   ├── MeshBuilder.ts              # ROLE: Сборка vertex/index-буферов из сплайнов.
    │   ├── CameraPredictor.ts          # ROLE: Клиентское предсказание позиции камеры; для спектатора использует позицию камеры.
    │   ├── CameraPredictor.test.ts     # ROLE: Тест обёртки/камеры спектатора в CameraPredictor.
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
    │       ├── PlayerMetrics.ts        # ROLE: Чистая математика размеров змейки (сегменты, радиус, туман).
    │       ├── PlayerMetrics.test.ts   # ROLE: Тесты размеров/тумана без DOM.
    │       ├── GrowableArray.ts        # ROLE: Динамически расширяемые массивы Float32 и Uint32 для буферов геометрии.
    │       ├── GrowableArray.test.ts   # ROLE: Тесты копирования буферов (без SharedArrayBuffer alias).
    │       ├── ColorUtils.ts           # ROLE: parseColor, lerpColors, hslToHex, glow-тинт для специальных скинов.
    │       ├── ColorUtils.test.ts      # ROLE: Тесты парсинга цветов и glow-тинтов скинов.
    │       └── ProtoFrameDecoder.ts    # ROLE: Минимальный Protobuf-декодер GameStateFrame для воркера. Не генерирует и не кодирует сообщения.
    ├── ui/
    │   ├── Minimap.ts                  # ROLE: 2D-радар на Canvas с частотой обновления экрана. Не UI, не ввод.
    │   ├── Minimap.test.ts             # ROLE: Тесты разбора lightweight-игроков для миникарты.
    │   ├── SteeringIndicator.ts        # ROLE: Шкала поворота мыши.
    │   ├── MobileControls.ts           # ROLE: Мобильное руление от центра экрана + нижняя зона буста.
    │   ├── personalStats.ts             # ROLE: Личный рекорд (score/length/kills) и его localStorage-персистенция.
    │   ├── personalStats.test.ts        # ROLE: Тесты рекорда: первый запуск, максимумы, битые данные.
    │   └── react/
    │       ├── gameUiStore.ts          # ROLE: Throttled window-event adapter + external store для игрового UI. Без рендеринга.
    │       ├── gameUiStore.test.ts     # ROLE: Тесты троттлинга лидерборда/счета и TTL killfeed.
    │       ├── GameHud.tsx             # ROLE: React-композиция HUD (счет, лидерборд, killfeed).
    │       ├── HudPanel.tsx            # ROLE: React score panel, score feed, ping и mobile-подсказки.
    │       ├── Leaderboard.tsx         # ROLE: React топ-таблица для HUD и настроек (опциональный выбор игрока).
    │       ├── KillFeed.tsx            # ROLE: React лента убийств.
    │       ├── SpectatorHud.tsx        # ROLE: Player-facing spectator HUD: бейдж, статус, follow и лидерборд.
    │       ├── SpectatorHud.test.tsx   # ROLE: Тесты spectator HUD и follow-событий.
    │       ├── mountSpectatorHud.tsx   # ROLE: Mount/unmount React spectator HUD.
    │       ├── mountGameHud.tsx        # ROLE: Mount/unmount React HUD в grid-контейнере.
    │       ├── GameHud.test.tsx        # ROLE: React HUD regression tests.
    │       ├── LoginScreen.tsx         # ROLE: React login and skin selection.
    │       ├── mountLoginScreen.tsx    # ROLE: Mount/unmount React login.
    │       ├── SettingsPanel.tsx       # ROLE: React controls/settings drawer.
    │       ├── mountSettingsPanel.tsx  # ROLE: Mount/unmount React settings.
    │       ├── GameOverScreen.tsx      # ROLE: React death overlay, run summary, personal best и respawn.
    │       ├── mountGameOverScreen.tsx # ROLE: Mount/unmount React game-over overlay.
    │       ├── LoginScreen.test.tsx    # ROLE: React login tests.
    │       ├── SettingsPanel.test.tsx  # ROLE: React settings tests.
    │       └── GameOverScreen.test.tsx # ROLE: React game-over tests.
    ├── admin/
    │   ├── adminApi.ts                 # ROLE: Admin API URL/fetch helper (dev/prod prefix).
    │   ├── ConfigEditor.ts             # ROLE: Состояние и бизнес-логика конфигурации админ-панели. Без UI.
    │   ├── ConfigEditor.test.ts        # ROLE: Regression tests for config save error handling.
    │   ├── FoodSimulator.ts            # ROLE: Canvas-симулятор распределения еды. Без UI.
    │   ├── AdminLabels.ts              # ROLE: Метаданные (названия полей, единицы измерения, подсказки) для панели администратора.
    │   └── react/
    │       ├── mountAdmin.tsx           # ROLE: Mount the React admin app; lazy-loaded from main.ts.
    │       ├── AdminApp.tsx             # ROLE: React admin root, session, health polling, config actions.
    │       ├── AdminLogin.tsx           # ROLE: React admin login form.
    │       ├── AdminDashboard.tsx       # ROLE: React admin layout, tabs, fields, notices and restart modal.
    │       ├── ConfigField.tsx          # ROLE: One typed config field card.
    │       ├── MapSizeCard.tsx          # ROLE: Width/height editor.
    │       ├── MapSimulator.tsx         # ROLE: Food distribution preview wrapper.
    │       ├── FoodTypesEditor.tsx      # ROLE: Food type editor.
    │       ├── RestartModal.tsx         # ROLE: Accessible restart confirmation dialog.
    │       └── AdminLogin.test.tsx      # ROLE: React admin login regression tests.
    └── types/
        └── game.ts                     # ROLE: Типы GameState, Player, Food и др. Только типы, без логики.
```

---

## Styles: `frontend/src/styles/`

```
frontend/src/styles/
├── main.css
├── hud_score.css
├── hud.css
├── login.css
├── admin.css
├── admin_react.css
├── minimap.css
└── settings.css
```

---

## Backend: `backend/`

```
backend/
├── server.py                           # ROLE: Точка входа FastAPI. Не содержит игровой логики.
├── game_config.py                      # ROLE: Конфигурация через датаклассы (включая секцию bots).
├── config.json                         # Runtime-конфигурация (атомарно пишется админкой; не редактировать вручную).
├── pyproject.toml                      # ROLE: PEP 621 metadata, runtime/dev dependencies, pytest + ruff config.
├── uv.lock                             # ROLE: [СГЕНЕРИРОВАНО] uv lockfile. Не редактировать вручную.
├── .python-version                     # ROLE: Python version for uv (3.13).
├── Dockerfile                          # ROLE: Production image на Python 3.13 + uv (non-root, healthcheck).
└── app/
    ├── api/
    │   ├── websocket.py                # ROLE: WebSocket endpoint, rate limiting, spectator/player identity. Не игровая логика.
    │   └── admin.py                    # ROLE: Admin REST API.
    ├── bots/
    │   ├── __init__.py                 # ROLE: Изолированный пакет ботов; удаляется вместе с 3 engine-хуками.
    │   ├── manager.py                  # ROLE: Lifecycle/спавн/респавн ботов, personalities и сглаживание руления. Без сети и рендера.
    │   └── brain.py                    # ROLE: Чистые решения руления (еда, перехват, отступление, объезд препятствий) + smooth_turn.
    └── engine/
        ├── game.py                     # ROLE: Оркестратор тика — только вызывает системы по порядку. Не содержит игровой логики.
        ├── registry.py                 # ROLE: Авто-дискавери и порядок систем.
        ├── events.py                   # ROLE: Синхронная шина событий.
        ├── state.py                    # ROLE: Контейнер игрового состояния, загрузка конфигурации, управление игроками. Не содержит игровой логики тика.
        ├── entities.py                 # ROLE: Датаклассы Player, Food, Portal, BlackHole. Только структуры данных.
        ├── food_manager.py             # ROLE: Жизненный цикл еды, кластеры, спавн.
        ├── world_elements/
        │   ├── base.py                 # ROLE: Generic PeriodicEntityManager (слоты/таймеры/рост).
        │   ├── portal.py               # ROLE: Спавн и поиск порталов.
        │   └── black_hole.py           # ROLE: Спавн, гравитация и kill-radius чёрных дыр.
        └── systems/
            ├── physics.py              # ROLE: Движение, тороидальное оборачивание. Не коллизии.
            ├── spatial_index.py        # ROLE: Единая пространственная сетка за тик.
            ├── collision.py            # ROLE: Столкновения змейка-змейка и надгробия, death/tombstone lifecycle. Не движение, не еда.
            ├── teleportation.py        # ROLE: FSM телепортации (5 состояний).
            ├── gravity.py              # ROLE: Притяжение еды чёрными дырами; таймеры ЧД обновляет game.py.
            ├── food_eating.py          # ROLE: Поедание и притяжение еды.
            ├── boost.py                # ROLE: Ускорение, потеря массы, спавн еды при бусте.
            ├── growth.py               # ROLE: Рост/усыхание, формула сегментов.
            ├── math_utils.py           # ROLE: toroidal_delta, toroidal_distance. ЕДИНСТВЕННАЯ копия математики на бэке.
            ├── visibility.py           # ROLE: AoI-фильтрация видимых игроков.
            ├── formula_parser.py       # ROLE: Единственная реализация парсера формул роста.
            ├── serialization.py        # ROLE: Protobuf-упаковка, AoI-фильтрация, кэши игроков.
            └── snake_pb2.py            # ROLE: [СГЕНЕРИРОВАНО] Python-модуль Protobuf.
```

---

## Тесты бэкенда: `backend/tests/`

```
backend/tests/
├── test_admin_auth.py                 # ROLE: Тесты Admin API аутентификации. Проверяет парсинг пароля, очистку пробелов/кавычек и работу login-обработчика.
├── test_admin_restart.py              # ROLE: Тесты Admin API restart-потока. Проверяет Protobuf restart-frame и очистку соединений.
├── test_black_hole_timer.py           # ROLE: Таймеры чёрных дыр двигаются ровно один раз за тик.
├── test_boost.py                      # ROLE: Буст сохраняет score целым; late join после буста не ломает FULL-синк.
├── test_bots.py                       # ROLE: Lifecycle, live config sync, respawn, personalities и руление ботов.
├── test_client_messages.py            # ROLE: Лимит длины текстовых команд клиента.
├── test_collision.py                   # ROLE: Тесты столкновений змейка-змейка.
├── test_dead_player_systems.py         # ROLE: Мёртвый игрок не двигается/ест/бустит и не ломает телепорт.
├── test_tombstones.py                  # ROLE: Уникальные ID после респавна и collision-radius надгробия.
├── test_events.py                      # ROLE: Тесты EventBus.
├── test_formula_parser.py              # ROLE: Тесты парсера формул роста.
├── test_frame_parity.py                # ROLE: Round-trip parity-тест сетевого кадра. Кодирует → декодирует → сравнивает с .expected.json.
├── test_gravity.py                     # ROLE: Тестирование системы гравитации (притяжения еды).
├── test_gravity_once_per_tick.py        # ROLE: Тест: гравитация чёрных дыр применяется к углу змейки ровно один раз за тик.
├── test_growth.py                      # ROLE: Тесты роста/усыхания змейки.
├── test_math_parity.py                 # ROLE: Parity-тест тороидальной математики. Сверяет Python с golden vectors.
├── test_physics.py                     # ROLE: Тесты физики движения.
├── test_serialization_cache_race.py    # ROLE: Позднее подключение игрока не вызывает KeyError в кэше кадра.
├── test_server_resilience.py           # ROLE: Сбой сериализации одного клиента не убивает game loop.
├── test_spectator_identity.py          # ROLE: Spectator не переиспользует player client_id; неудачный handshake не оставляет призрака.
├── test_world_lifecycle.py             # ROLE: Resize карты и полная очистка World.reset_state.
├── test_world_elements.py              # ROLE: Тесты порталов и чёрных дыр.
└── generate_frame_fixtures.py          # ROLE: Генерация эталонных кадров для parity-тестов. Запуск вручную при изменении формата.
```

`backend/pyproject.toml` задаёт pytest (`testpaths`, `pythonpath`, async loop scope) и Ruff.

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
    └── ci.yml                          # ROLE: CI: Ruff/Biome/tsc/pytest/vitest, audits and Docker builds on push/PR.
```

---

## Git hooks and repo tooling

```
.pre-commit-config.yaml                # ROLE: Ruff/tests on commit, full lint/tests/build on push.
scripts/
└── run_checks.py                      # ROLE: cross-platform backend/frontend check runner used by hooks.
```

Setup per clone (requires uv >= 0.11):

```bash
uv sync --project backend
uv run --project backend pre-commit install
```

---

## OpenCode V2 environment

```
opencode.jsonc                          # ROLE: Project config: instructions, watcher ignores.
.opencode/
├── instructions/
│   └── project.md                      # ROLE: Project rules, commands, hard invariants.
├── agents/
│   └── reviewer.md                     # ROLE: Read-only review subagent.
├── commands/
│   ├── review.md                       # ROLE: /review — run the reviewer on the current diff.
│   └── verify.md                       # ROLE: /verify — run backend/frontend checks.
└── skills/
    └── netcode-change/SKILL.md          # ROLE: Checklist for safe frame/toroidal-math changes.
```
