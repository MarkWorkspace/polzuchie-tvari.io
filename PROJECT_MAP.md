# PROJECT_MAP.md

> Этот файл поддерживается AI-агентами. Обновляется после каждого структурного изменения.
> Правила и рабочие команды — в `.opencode/instructions/project.md` (OpenCode V2).

---

## Repository root

```
.
├── README.md                           # ROLE: Quickstart, stack, checks and docs index.
├── RUNBOOK.md                          # ROLE: Deploy/rollback, health triage, config restore, OOM/WS/TLS и учебный drill log.
├── SECURITY.md                         # ROLE: Supported versions, private vulnerability reporting и threat model.
├── REMEDIATION_PLAN.md                 # ROLE: Decomposed audit remediation plan; one task = one subagent.
├── docs/
│   ├── HISTORY.md                      # ROLE: Historical changelog M1–M5 and pre-remediation fixes; not current state.
│   └── adr/
│       ├── README.md                   # ROLE: ADR index and format; links to accepted decisions.
│       ├── ADR-001-session-auth.md     # ROLE: Player HttpOnly cookie, WS identity и spectator isolation.
│       ├── ADR-002-frame-sequencing.md # ROLE: frame_seq/server_tick, FULL-coalescing и RESYNC.
│       ├── ADR-003-config-ownership.md # ROLE: World.config ownership, transactional save и config volume.
│       ├── ADR-004-grid-world-conversion.md # ROLE: grid↔world helper, half-cell и torus boundaries.
│       └── ADR-005-tick-events.md      # ROLE: Tick-boundary removals, killfeed/food drop и failed handshake.
├── .env.example                        # ROLE: Docker port, admin password and log-level template.
├── .dockerignore                       # ROLE: Build-context exclusions for the root/compose build context.
├── .editorconfig                       # ROLE: Shared editor whitespace/charset conventions.
├── .gitattributes                      # ROLE: Line-ending and binary-file rules.
├── .pre-commit-config.yaml             # ROLE: Git hooks (Ruff/tests/build).
├── .github/dependabot.yml              # ROLE: Weekly dependency updates for uv, npm, actions, Docker and hooks.
├── opencode.jsonc                      # ROLE: OpenCode V2 project config.
├── docker-compose.yml                  # ROLE: Local production-like stack with BACKEND_IMAGE/FRONTEND_IMAGE overrides; passes ALLOWED_ORIGINS to backend, persists runtime config in the backend_config named volume.
├── start_dev.bat                       # ROLE: Windows dev launcher (uv + Vite).
└── scripts/run_checks.py               # ROLE: Cross-platform check runner used by hooks.
```

---

## Frontend: `frontend/`

```
frontend/
├── index.html
├── vite.config.ts                      # ROLE: Vite/Vitest config; production build выносит three/postprocessing и React в отдельные vendor-chunks.
├── package.json
├── package-lock.json
├── tsconfig.json                       # ROLE: Production TypeScript config (strict, excludes tests).
├── tsconfig.test.json                  # ROLE: Test TypeScript config (DOM + Node types).
├── biome.json                          # ROLE: Biome lint/format config for the frontend.
├── playwright.config.ts                # ROLE: Playwright E2E config; поднимает isolated backend с temp config и `vite preview` production-сборки.
├── e2e/
│   ├── adminApi.ts                     # ROLE: Общие REST-хелперы Playwright для админ-конфига.
│   ├── game.spec.ts                    # ROLE: Smoke login, HUD и настроек качества.
│   ├── sessionLock.spec.ts             # ROLE: Web Locks: вторая player-вкладка, takeover и сохранение player ID.
│   ├── death.spec.ts                   # ROLE: Реальная смерть от чёрной дыры, game-over и respawn.
│   ├── bots.spec.ts                    # ROLE: Live-включение/выключение ботов через админку.
│   ├── spectator.spec.ts               # ROLE: Player- и debug-спектатор, follow по клику и возврат к обзору.
│   ├── security.spec.ts                # ROLE: Origin allowlist и role caps WebSocket: cross-origin отказ, spectator flood, player slot.
│   ├── webgl.spec.ts                   # ROLE: WebGL context lifecycle: loss → пауза rAF + overlay, restore → rebuild, рост `dataset.gameFrames` и продолжение loop без reload (skip без WEBGL_lose_context).
│   └── admin.spec.ts                   # ROLE: Smoke admin login/dashboard/logout.
├── .nvmrc                             # ROLE: Node.js version for the frontend toolchain (22).
├── .gitignore                          # ROLE: Frontend build/test output and editor artifacts.
├── .dockerignore                       # ROLE: Frontend Docker build-context exclusions.
├── Dockerfile                          # ROLE: Сборка и запуск фронтенда (Vite) в Docker; nginx non-root, digest-pinned bases.
├── nginx.conf                          # ROLE: SPA static serving, /ws proxy, cache/security headers, writable temp paths для non-root.
├── public/
│   ├── apple.svg                       # ROLE: SVG fallback для типа еды; 3D-геометрия имеет приоритет.
│   ├── cherry.svg                      # ROLE: SVG fallback для типа еды.
│   ├── grape.svg                       # ROLE: SVG fallback для типа еды.
│   ├── mandarin.svg                    # ROLE: SVG fallback для типа еды.
│   ├── melon.svg                       # ROLE: SVG fallback для типа еды.
│   ├── peach.svg                       # ROLE: SVG fallback для типа еды.
│   ├── pear.svg                        # ROLE: SVG fallback для типа еды.
│   ├── persimmon.svg                   # ROLE: SVG fallback для типа еды.
│   ├── pineapple.svg                   # ROLE: SVG fallback для типа еды.
│   ├── strawberry.svg                  # ROLE: SVG fallback для типа еды.
│   ├── watermelon.svg                  # ROLE: SVG fallback для типа еды.
│   ├── favicon.svg                     # ROLE: Favicon приложения.
│   ├── icons.svg                       # ROLE: SVG-спрайт интерфейсных иконок.
│   └── fonts/                          # ROLE: Self-hosted Outfit WOFF2 files.
└── src/
    ├── assets/                         # ROLE: Статические изображения/логотипы Vite-шаблона; не игровые текстуры.
    ├── main.ts                         # ROLE: Route selection and lazy loading; no game logic.
    ├── game/
    │   ├── bootstrap.ts                # ROLE: Lazy game UI bootstrap (runtime Worker/WebGL2 check, login, HUD, dynamic Game/Three import on Play, startup error overlay).
    │   ├── bootstrap.test.ts           # ROLE: Тесты pre-login проверки Worker/WebGL2 и ленивого Game-модуля через loadGameModule.
    │   ├── spectatorBootstrap.ts       # ROLE: Lazy spectator bootstrap; выбирает player-HUD или debug-панели.
    │   ├── spectatorMode.ts            # ROLE: Чистый разбор `?spectator=` / `?debug=` в player/debug режим.
    │   ├── spectatorMode.test.ts       # ROLE: Тесты маршрутизации player/debug-спектатора.
    │   ├── Game.ts                     # ROLE: Жизненный цикл приложения: init/update/destroy, пауза rAF и reload-overlay при потере WebGL-контекста, возобновление loop после restore, overlay при фатальном сбое worker, `dataset.gameFrames` как E2E/debug-наблюдаемость. Не содержит рендеринг.
    │   ├── RenderOrchestrator.ts       # ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены; считает ground-target травы со смещением вперёд по камере, строит ground-трапецию камеры и distance-LOD. Не содержит логики ввода или сети.
    │   ├── InputManager.ts             # ROLE: Ввод с клавиатуры, мыши, тача, гироскопа; guard editable/HUD и resync. Не UI, не сеть.
    │   ├── InputManager.test.ts        # ROLE: Тесты editable/HUD guard, UI-open паузы и resync ввода.
    │   ├── NetworkManager.ts           # ROLE: WebSocket-интерфейс к воркеру, requestId-корреляция кадров, player-session bootstrap (POST /session), worker watchdog/restart с backoff. Не бизнес-логика.
    │   ├── NetworkManager.test.ts      # ROLE: Тесты session bootstrap, WS URL без client_id, reconnect backoff, requestId-корреляции и worker watchdog/restart.
    │   ├── PlayerSessionLock.ts        # ROLE: Web Locks + BroadcastChannel: одна player-вкладка, takeover между вкладками. Не сеть и не UI.
    │   ├── SpectatorApp.ts             # ROLE: Ядро спектатора: камера, сеть, рендер; debug UI вынесен отдельно.
    │   ├── SpectatorDebugOverlay.ts    # ROLE: Админские debug-панели спектатора (статы, выбор змейки).
    │   ├── SpectatorCamera.ts          # ROLE: Камера спектатора: pointer drag/пан, pinch-zoom, wheel и плавное слежение за игроком.
    │   ├── SpectatorCamera.test.ts     # ROLE: Тесты pointer-пана, pinch-zoom и игнорирования не-основных кнопок мыши.
    │   ├── spectatorCameraMath.ts     # ROLE: Тонкие wrapper'ы follow-камеры (shortestToroidalDelta/wrapWithin) над shared MathUtils; своей математики не содержат.
    │   ├── spectatorCameraMath.test.ts # ROLE: Тесты перехода камеры через границу карты и делегирования в MathUtils.
    │   ├── Camera.ts                   # ROLE: Следование камеры, зум; не двигает камеру при нефинитных camX/camY. Не рендеринг.
    │   ├── Camera.test.ts              # ROLE: Тесты finite-guard камеры (пустой кадр не даёт NaN-позу).
    │   └── Config.ts                   # ROLE: Клиентские константы мира (WORLD_*, gridSize=20) и список скинов. Скорости/углы/тикрейт приходят в server_simulation.
    ├── lib/
    │   ├── escapeHtml.ts               # ROLE: Escaping untrusted strings before HTML insertion.
    │   ├── i18n.ts                     # ROLE: Локализация текстов интерфейса (RU/EN). Не содержит игровую логику.
    │   ├── safeStorage.ts              # ROLE: Non-throwing обёртка над localStorage (get/set/remove) для private mode/quota/blocked storage.
    │   └── safeStorage.test.ts         # ROLE: Тесты safeStorage: round-trip и бросающие storage-моки.
    ├── renderer/
    │   ├── SceneManager.ts             # ROLE: Оркестратор Three.js рендера: сцена/камера/рендерер, пресеты качества, adaptive pixel ratio по GPU time с GpuWatchdog, world-space contact shadow, композер, context-loss/restore lifecycle и пересборка собственных GPU-ресурсов. Свет/тени делегирует SceneLighting, землю — GroundPlane, туман — FogOverlay; их параметров не содержит.
    │   ├── SceneLighting.ts            # ROLE: Sun/hemisphere/fill rig, пул snake-light'ов, shadow-map quality (mapSize/bias/radius/ortho) и per-frame слежение света за камерой. Отдаёт shadowCameraExtent(fogRadiusWorld); renderer не создаёт.
    │   ├── SceneLighting.test.ts       # ROLE: Тесты shadowCameraExtent: default, масштаб и clamp 300..900.
    │   ├── GroundPlane.ts              # ROLE: Меш земли с процедурным grass/grid-шейдером, apron-геометрия 4×, groundTransform и receiveShadow. Не свет, не рендерер.
    │   ├── GroundPlane.test.ts         # ROLE: Тесты groundTransform для квадратной и прямоугольной карты (позиция и масштаб).
    │   ├── FogOverlay.ts               # ROLE: Aerial scene fog + круговой ground-fog overlay: цвета, шейдеры, aerialFogRange/fogWarmMix, follow камеры и тёплый дрейф от направления взгляда. Не владеет камерой или рендерером.
    │   ├── FogOverlay.test.ts          # ROLE: Тесты aerialFogRange и fogWarmMix (к солнцу теплее, clamp 0..0.2).
    │   ├── SnakeContactShadow.ts       # ROLE: World-space contact shadow: adaptive top-down ortho-маска тела (box 180–600 юнитов из view cone, маска 512/256 → до 1024), key-light parallax offset (1.78, 1.33), два separable Gaussian-прохода в world units (radius 4, opacity 0.5) и один quad на земле; отдаёт размытую маску траве через getFrame(). Не свет, не shadow map, не пост-эффект.
    │   ├── SnakeContactShadow.test.ts  # ROLE: Тесты light-offset, adaptive extent/resolution, texel size, world-radius → texels, blur step, quad pose и защиты от toroidal wrap-дубля.
    │   ├── GrassRenderer.ts            # ROLE: Один instanced mesh травы: 5 травинок в широкой розетке, детерминированные пучки из сида, когерентный world-space ветер (глобальное направление + advected noise gust + per-blade flutter), локальное раздвигание у головы, per-blade tint, root-shadow decals, приминание с наклоном/раскрытием блейдов по dilated contact mask и направлению 32-секундного trail, сухой tint следа, dither-фейд края, stable density cache и shader-side distance-LOD. Бюджет/радиус — из пресета; декор без коллизий.
    │   ├── GrassTrail.ts               # ROLE: CPU-буфер следа змейки: 128 точек кончика хвоста, затухание 32 с, шаг 250 мс, сброс на телепорте/торе; resolve хвоста из `activePlayers` worker-кадра. Не рендерит.
    │   ├── GrassTrail.test.ts          # ROLE: Тесты интервала, затухания, срока жизни, телепорта, ёмкости trail-буфера и выбора хвоста из activePlayers.
    │   ├── DecorField.ts               # ROLE: Чистая математика декора: хэш клетки, тороидальная генерация куртин двух масштабов (fine 20 u / broad 80 u), общий цвет/высота/сухость clump'а, стабильная плотность клетки, раскладка камней, пер-тировые бюджеты, camera-distance LOD и клип по ground-трапеции.
    │   ├── DecorField.test.ts          # ROLE: Тесты детерминизма, тора, кластеров, бюджетов и устойчивости к NaN.
    │   ├── PropRenderer.ts             # ROLE: Один instanced mesh вкопанных камней-акцентов. Декор без коллизий, без теней и bloom.
    │   ├── PropGeometry.ts             # ROLE: Процедурные силуэты камней. Не рендерит.
    │   ├── DecorUpdateGate.ts          # ROLE: Общий throttle перестроения декора: 250 мс для сдвига, 60 мс для поворота/зума, инвалидация при смене пресета/карты.
    │   ├── SnakeLightPool.ts           # ROLE: Пул из 3–4 головных PointLight для ближайших змей; без теней и геймплея.
    │   ├── SnakeLightPool.test.ts      # ROLE: Тест приоритета local player, лимита и очистки пула.
    │   ├── SnakeRenderer.ts            # ROLE: Меши змеек, emissive-скины, skin-tinted head glow. Тело попадает в bloom-маску и top-down contact-shadow маску через отдельные слои; само тень не кастует. Не физика, не HUD.
    │   ├── SnakeRenderer.test.ts       # ROLE: Тесты dynamic update ranges буферов тела/индексов; не покрывает материалы и instanced eyes.
    │   ├── SnakeRenderer.glow.test.ts  # ROLE: Тесты размещения head-only glow (bloom рисует свечение тела).
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
    │   ├── FruitGeometryUtils.ts       # ROLE: Общая пост-обработка фруктов: удаляет вырожденные треугольники, центрирует и нормирует bounding sphere к 1.0.
    │   ├── FoodGeometry.test.ts        # ROLE: Регрессионные тесты инвариантов всех 11 фруктовых геометрий (unit-радиус, центр, нормали, бюджет).
    │   ├── PortalRenderer.ts           # ROLE: Визуализация порталов.
    │   ├── BlackHoleRenderer.ts        # ROLE: Визуализация чёрных дыр.
    │   ├── TombstoneRenderer.ts        # ROLE: Инстансированные upright-надгробия: позиция, yaw, тени, emissive-подъём.
    │   ├── TombstoneGeometry.ts        # ROLE: Процедурная плита с аркой и основанием. Не рендерит и не анимирует.
    │   ├── TombstoneGeometry.test.ts   # ROLE: Тест габаритов/ориентации и наличия нормалей надгробия.
    │   ├── ParticleRenderer.ts         # ROLE: Мягкие additive-частицы хвоста (radial sprite без текстуры).
    │   ├── GlobeLens.ts                # ROLE: Чистая математика globe warp/overscan и финальный screen-space GlobeEffect с limb darkening. Без знания сцены.
    │   ├── GlobeLens.test.ts           # ROLE: Тесты warp-функции и overscan для разных aspect/curvature.
    │   ├── PostProcessing.ts           # ROLE: EffectComposer-пайплайн: bloom/tone mapping и bloom-маска в общем pass; линзирование ЧД отдельным pass; atmosphere grade; globe warp финальным pass.
    │   ├── SilhouetteRenderer.ts       # ROLE: Растеризует слой в маленький alpha-таргет (bloom-маска). Не свет, не пост-эффекты.
    │   ├── SilhouetteRenderer.test.ts  # ROLE: Тесты размера silhouette-таргета под pixel ratio и downscale.
    │   ├── RenderQuality.ts            # ROLE: Пресеты качества (auto/high/medium/low), shadow map/radius, contact-shadow base resolution, отдельные grass/grassRadius/stone бюджеты, snake-light budget; персистенция через safeStorage.
    │   ├── AdaptiveResolution.ts       # ROLE: Чистый сэмплер GPU time / frame time → pixel ratio: окно 45 GPU-сэмплов, пороги 14/18 ms, clamp; frame-time fallback. Без DOM/WebGL.
    │   ├── AdaptiveResolution.test.ts  # ROLE: Тесты адаптивного разрешения: frame-time fallback, GPU-окно 45 сэмплов, границы 14/18 ms и независимые аккумуляторы.
    │   ├── GpuTimer.ts                 # ROLE: Обёртка одной in-flight EXT_disjoint_timer_query_webgl2 query на core WebGL2 API: begin/end/poll в ms, disjoint, reset(), mutable support, dispose. Без рендера.
    │   ├── GpuTimer.test.ts            # ROLE: Тесты GpuTimer на fake WebGL2: имя extension, null query, pending/recording, disjoint, reset, dispose.
    │   ├── GpuWatchdog.ts              # ROLE: Чистый watchdog adaptive resolution: visibility-переходы, 5-секундный таймаут GPU-сэмплов, fallback flag и восстановление по сэмплу. Без DOM/WebGL.
    │   ├── GpuWatchdog.test.ts         # ROLE: Тесты watchdog: unsupported, таймаут/восстановление, скрытая вкладка, reset и hidden-кадры.
    │   ├── RenderQuality.test.ts       # ROLE: Тесты пресетов качества и localStorage.
    │   ├── RenderConfig.ts             # ROLE: Слои отрисовки, overlay-layer для эффектов вне dedicated-пассов и shadow map, bloom-mask и snake-shadow mask layers, фабрики материалов и glow-конверсия.
    │   ├── RenderConfig.test.ts        # ROLE: Тест перевода head_glow_radius из клеток в мировые единицы.
    │   ├── DebugRenderer.ts            # ROLE: Отрисовка отладочной сетки и коллизий в режиме debug.
    │   ├── DebugRenderer.test.ts       # ROLE: Тест кратности debug-буферов размеру атрибута.
    │   └── shaders/
    │       ├── snakeBody.glsl.ts       # ROLE: Шейдер плоской ленты: 5 скинов, sRGB→linear, emissive, контур.
    │       ├── snakeBody.glsl.test.ts  # ROLE: Тест точек patch'а тела (linear color, emissive, saturation).
    │       ├── food.glsl.ts            # ROLE: Шейдер еды.
    │       ├── portal.glsl.ts          # ROLE: Шейдер портала.
    │       ├── blackHole.glsl.ts       # ROLE: Шейдер чёрной дыры.
    │       └── ground.glsl.ts          # ROLE: Шейдер пола: AA-сетка, периодическая по карте процедурная фактура, анизотропные grass-пряди и distance fade.
    ├── worker/
    │   ├── worker.ts                   # ROLE: Точка входа воркера, onmessage-роутер, FRAME_DATA/FRAME_UNAVAILABLE с requestId. Не содержит вычислений.
    │   ├── worker.test.ts              # ROLE: Тесты FRAME_UNAVAILABLE и проброса requestId из воркера.
    │   ├── StateInterpolation.ts       # ROLE: Очередь до 20 состояний, jitter-фильтр таймлайна и интерполяция между тиками.
    │   ├── SplineComputer.ts           # ROLE: Расчёт 3D-сплайнов змеек на scratch-буферах без per-point аллокаций.
    │   ├── SplineComputer.test.ts      # ROLE: Тесты сплайнов: density, split на портале, unwrap границы, self-offset и независимость результатов.
    │   ├── MeshBuilder.ts              # ROLE: Сборка vertex/index-буферов из сплайнов.
    │   ├── CameraPredictor.ts          # ROLE: Клиентское предсказание позиции камеры; для спектатора использует позицию камеры.
    │   ├── CameraPredictor.test.ts     # ROLE: Тест обёртки/камеры спектатора в CameraPredictor.
    │   ├── FoodComputer.ts             # ROLE: Матрицы и цвета инстансов еды на переиспользуемых позициях; last-food кэш на WeakRef пересобирается по смене ссылки.
    │   ├── FoodComputer.test.ts        # ROLE: Тесты еды: fog/visibleCount, интерполяция, attraction, black-hole gravity/fast path и смена lastState.
    │   ├── PortalComputer.ts           # ROLE: Матрицы инстансов порталов.
    │   ├── PortalComputer.test.ts      # ROLE: Тест привязки центров порталов к gridToWorld.
    │   ├── BlackHoleComputer.ts        # ROLE: Матрицы инстансов чёрных дыр.
    │   ├── BlackHoleComputer.test.ts   # ROLE: Тест привязки центров ЧД к gridToWorld.
    │   ├── ParticleComputer.ts         # ROLE: Симуляция частиц хвоста.
    │   ├── EyeComputer.ts              # ROLE: Позиции глаз и зрачков змеек.
    │   ├── DeltaDecoder.ts             # ROLE: Декодирование delta-стейтов с сервера, body/new_heads truth table (dead/truncated/head), final_length и clamp длины. Не сеть, не интерполяция.
    │   ├── DeltaDecoder.parity.test.ts # ROLE: Parity-тест всех golden-кадров: death/final_length, teleport, AoI transition/truncated, seam, empty-мир и seq.
    │   ├── WebSocketClient.ts          # ROLE: WebSocket-соединение, cookie-handshake, реконнект с backoff по close-кодам, ping/pong, seq-контроль кадров и RESYNC с cooldown. Не бизнес-логика.
    │   ├── WebSocketClient.test.ts     # ROLE: Тесты FrameSequencer (full/delta/gap/wrap), cooldown RESYNC и decode-error пути.
    │   ├── FrameComputer.ts            # ROLE: Сборка кадра игры (матрицы, вершины, лидерборд) для отправки на фронтенд.
    │   ├── SnakeProcessor.ts           # ROLE: Обработка сплайнов, мешей, глаз и частиц змеек на каждом кадре воркера; публикует tail-tip в activePlayers для травяного следа. Не содержит рендеринг.
    │   └── shared/
    │       ├── MathUtils.ts            # ROLE: Единственный источник torus-математики: wrapNearest, wrapDelta, toroidalDelta/Distance/Lerp, randomRange, writeMatrix. Не сеть/рендер/состояние.
    │       ├── MathUtils.parity.test.ts # ROLE: Parity-тест тороидальной математики. Сверяет TS с golden vectors.
    │       ├── PlayerMetrics.ts        # ROLE: Чистая математика размеров змейки (сегменты, радиус, туман).
    │       ├── PlayerMetrics.test.ts   # ROLE: Тесты размеров/тумана без DOM.
    │       ├── GrowableArray.ts        # ROLE: Динамически расширяемые массивы Float32 и Uint32 для буферов геометрии.
    │       ├── GrowableArray.test.ts   # ROLE: Тесты копирования буферов (без SharedArrayBuffer alias).
    │       ├── ColorUtils.ts           # ROLE: parseColor, lerpColors, hslToHex, glow-тинт для специальных скинов.
    │       ├── ColorUtils.test.ts      # ROLE: Тесты парсинга цветов и glow-тинтов скинов.
    │       ├── WorldMath.ts            # ROLE: Единое преобразование координат grid↔world (gridToWorldX/Y, worldToGridX/Y, worldSizeFromGrid). Не выполняет тороидальный wrap.
    │       ├── WorldMath.test.ts       # ROLE: Тесты известных точек, round-trip и seam для grid↔world.
    │       ├── WorkerProtocol.ts       # ROLE: Типы wire-протокола main↔worker (MainToWorker/WorkerToMain, FrameContext, SnakeContext, FrameDataMessage). Только типы, без логики.
    │       └── ProtoFrameDecoder.ts    # ROLE: Минимальный Protobuf-декодер GameStateFrame/Player (включая final_length и frame_seq/server_tick) для воркера. Не генерирует и не кодирует сообщения.
    ├── ui/
    │   ├── Minimap.ts                  # ROLE: 2D-радар на Canvas с throttle 12 Гц и cap food-точек. Не UI, не ввод.
    │   ├── Minimap.test.ts             # ROLE: Тесты throttle, food cap и lightweight-игроков для миникарты.
    │   ├── SteeringIndicator.ts        # ROLE: Шкала поворота мыши.
    │   ├── MobileControls.ts           # ROLE: Мобильное руление от центра экрана + нижняя зона буста.
    │   ├── personalStats.ts             # ROLE: Личный рекорд (score/length/kills) и его персистенция через safeStorage.
    │   ├── personalStats.test.ts        # ROLE: Тесты рекорда: первый запуск, максимумы, битые данные.
    │   └── react/
    │       ├── gameUiStore.ts          # ROLE: Throttled window-event adapter + external store для игрового UI. Без рендеринга.
    │       ├── gameUiStore.test.ts     # ROLE: Тесты троттлинга лидерборда/счета и TTL killfeed.
    │       ├── useFocusTrap.ts         # ROLE: Переиспользуемый focus trap модалок: initial focus, Tab/Shift+Tab loop, restore focus, Escape.
    │       ├── useFocusTrap.test.tsx   # ROLE: Тесты getFocusableElements и focus trap (wrap/disabled/escape/restore).
    │       ├── GameHud.tsx             # ROLE: React-композиция HUD (счет, лидерборд, killfeed) + offscreen aria-live статус подключения.
    │       ├── HudPanel.tsx            # ROLE: React score panel, score feed, ping и mobile-подсказки.
    │       ├── Leaderboard.tsx         # ROLE: React топ-таблица для HUD и настроек (опциональный выбор игрока).
    │       ├── KillFeed.tsx            # ROLE: React лента убийств с role=log/aria-live.
    │       ├── SpectatorHud.tsx        # ROLE: Player-facing spectator HUD: бейдж, aria-live статус, follow и лидерборд.
    │       ├── SpectatorHud.test.tsx   # ROLE: Тесты spectator HUD и follow-событий.
    │       ├── mountSpectatorHud.tsx   # ROLE: Mount/unmount React spectator HUD.
    │       ├── mountGameHud.tsx        # ROLE: Mount/unmount React HUD в grid-контейнере.
    │       ├── GameHud.test.tsx        # ROLE: React HUD regression tests.
    │       ├── LoginScreen.tsx         # ROLE: React login, skin selection и cross-tab conflict flow.
    │       ├── mountLoginScreen.tsx    # ROLE: Mount/unmount React login.
    │       ├── SessionMovedScreen.tsx  # ROLE: React-экран вкладки, у которой забрали player-сессию; dialog + focus trap.
    │       ├── SessionMovedScreen.test.tsx # ROLE: Тесты session-moved dialog, focus trap и действий.
    │       ├── mountSessionMovedScreen.tsx # ROLE: Mount/unmount React session-moved screen.
    │       ├── SettingsPanel.tsx       # ROLE: React controls/settings drawer с dialog/focus trap.
    │       ├── mountSettingsPanel.tsx  # ROLE: Mount/unmount React settings.
    │       ├── GameOverScreen.tsx      # ROLE: React death overlay, run summary, personal best и respawn; dialog + focus trap.
    │       ├── mountGameOverScreen.tsx # ROLE: Mount/unmount React game-over overlay.
    │       ├── GameErrorOverlay.tsx    # ROLE: Blocking renderer error alertdialog с reload и focus trap; от WebGL не зависит.
    │       ├── GameErrorOverlay.test.tsx # ROLE: Тесты alertdialog, начального фокуса и reload.
    │       ├── mountGameErrorOverlay.tsx # ROLE: Mount/unmount error overlay + imperative show/hide.
    │       ├── LoginScreen.test.tsx    # ROLE: React login tests.
    │       ├── SettingsPanel.test.tsx  # ROLE: React settings tests.
    │       └── GameOverScreen.test.tsx # ROLE: React game-over tests.
    ├── admin/
    │   ├── adminApi.ts                 # ROLE: Admin API URL/fetch helper (dev/prod prefix).
    │   ├── ConfigEditor.ts             # ROLE: Состояние и бизнес-логика конфигурации админ-панели. Без UI.
    │   ├── ConfigEditor.test.ts        # ROLE: Regression tests for save result kinds and image path validation.
    │   ├── foodImagePath.ts            # ROLE: Food image path allowlist/sanitizer. No fetch or UI.
    │   ├── foodImagePath.test.ts       # ROLE: Tests for safe/unsafe food image paths.
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
├── settings.css
└── spectator.css                       # ROLE: Player-facing spectator HUD, admin debug-панели и touch-action для spectator-камеры.
```

---

## Backend: `backend/`

```
backend/
├── server.py                           # ROLE: Точка входа FastAPI: liveness `/health`, readiness `/ready`, game loop с tick-метриками. Не содержит игровой логики.
├── game_config.py                      # ROLE: Конфигурация через датаклассы (включая секцию bots).
├── config.json                         # Runtime-конфигурация (untracked; пишется админкой в named volume, не редактировать вручную).
├── config.example.json                 # ROLE: Seed-шаблон runtime-конфига для пустого Docker volume. Приложением напрямую не читается.
├── config.schema-version               # ROLE: Версия схемы runtime-конфига (отдельный файл; GameConfig её не читает).
├── docker-entrypoint.sh                # ROLE: Засевает config volume из config.example.json без перезаписи live-файла и запускает CMD.
├── pyproject.toml                      # ROLE: PEP 621 metadata, runtime/dev dependencies, pytest + ruff config.
├── uv.lock                             # ROLE: [СГЕНЕРИРОВАНО] uv lockfile. Не редактировать вручную.
├── .dockerignore                       # ROLE: Backend Docker build-context exclusions.
├── .python-version                     # ROLE: Python version for uv (3.13).
├── Dockerfile                          # ROLE: Production image на Python 3.13 + uv (digest-pinned bases, non-root, seeded config volume, healthcheck, WS flags, graceful shutdown 10s).
├── scripts/
│   └── generate_proto.py               # ROLE: Регенерация snake_pb2.py из tests_shared/snake.proto. Не runtime-код.
└── app/
    ├── logging_setup.py                # ROLE: Настройка stdlib logging и LOG_LEVEL. Не игровая логика.
    ├── api/
    │   ├── admin.py                    # ROLE: Admin REST API, config read/write (503 на сбой apply/save), restart с draining/очисткой соединений, liveness/readiness и tick-метрики, JSON audit login/config/restart, X-Real-IP только за trusted proxy и bounded login limiter. Не игровая логика.
    │   ├── config_schema.py            # ROLE: Pydantic-схема PATCH /admin/config из dataclass'ов GameConfig. Без диапазонов значений.
    │   ├── session.py                  # ROLE: Player session store + POST/DELETE /session cookie и resolver для WS. WS-аутентификацию выполняет websocket.py.
    │   └── websocket.py                # ROLE: WebSocket endpoint: Origin allowlist, per-IP handshake bucket, role caps via pending reservation, cookie-auth identity, epoch/reconnect grace, draining admission, RESYNC→FULL с cooldown; initial FULL snapshot на event loop, zlib.compress(level=1) в to_thread. Не игровая логика.
    ├── bots/
    │   ├── __init__.py                 # ROLE: Изолированный пакет ботов; удаляется вместе с 3 engine-хуками.
    │   ├── manager.py                  # ROLE: Lifecycle/спавн/респавн ботов, personalities и сглаживание руления. Без сети и рендера.
    │   └── brain.py                    # ROLE: Чистые решения руления (еда, перехват, отступление, объезд препятствий) + smooth_turn.
    └── engine/
        ├── game.py                     # ROLE: Оркестратор тика — только вызывает системы по порядку. Не содержит игровой логики.
        ├── registry.py                 # ROLE: Авто-дискавери и порядок систем.
        ├── events.py                   # ROLE: Синхронная шина событий.
        ├── state.py                    # ROLE: Контейнер игрового состояния: игроки, спектаторы, сетка, менеджеры, draining/restart_epoch, frame_seq/server_tick, tick-метрики и reset. Фасад совместимости с тонкими wrappers на ConfigStore/InputRouter/SnapshotService. Не содержит игровой логики тика.
        ├── config_store.py             # ROLE: GameConfig, CONFIG_PATH, компиляция формул роста и транзакционное сохранение конфига (backup/rollback, atomic replace, bind-mount fallback). Не владеет игроками/менеджерами.
        ├── input_router.py             # ROLE: Разбор turn/boost/respawn/control-mode и применение к Player. Не тик, не сеть, не сериализация.
        ├── snapshot_service.py         # ROLE: Делегаты get_delta_state/get_full_state в serialization и запись AoI-видимости клиента. Не строит кадры сам.
        ├── entities.py                 # ROLE: Датаклассы Player, Food, Portal, BlackHole. Только структуры данных.
        ├── food_manager.py             # ROLE: Жизненный цикл еды, кластеры, спавн, live-пересчёт радиусов.
        ├── world_elements/
        │   ├── base.py                 # ROLE: Generic PeriodicEntityManager (слоты/таймеры/рост) + хук apply_config.
        │   ├── portal.py               # ROLE: Спавн, поиск порталов и live-радиус.
        │   └── black_hole.py           # ROLE: Спавн, гравитация, kill-radius и live-радиусы чёрных дыр.
        └── systems/
            ├── physics.py              # ROLE: Движение, тороидальное оборачивание. Не коллизии.
            ├── spatial_index.py        # ROLE: Единая пространственная сетка за тик.
            ├── collision.py            # ROLE: Столкновения змейка-змейка и надгробия, death/tombstone lifecycle. Не движение, не еда.
            ├── teleportation.py        # ROLE: FSM телепортации (5 состояний).
            ├── gravity.py              # ROLE: Притяжение еды чёрными дырами; таймеры ЧД обновляет game.py.
            ├── food_eating.py          # ROLE: Поедание и притяжение еды.
            ├── boost.py                # ROLE: Ускорение, потеря массы, спавн еды при бусте.
            ├── growth.py               # ROLE: Рост/усыхание, формула сегментов.
            ├── math_utils.py           # ROLE: wrap_coordinate, wrap_delta, toroidal_delta, toroidal_distance. ЕДИНСТВЕННАЯ копия torus-математики на бэке.
            ├── visibility.py           # ROLE: AoI-фильтрация видимых игроков.
            ├── formula_parser.py       # ROLE: Единственный AST compile/eval формул роста: validation и runtime. Не regex-парсер.
            ├── serialization.py        # ROLE: Protobuf-упаковка, AoI-фильтрация, truth table body/new_heads/body_truncated/final_length, frame_seq/server_tick, кэши игроков, единый build_full_frame для handshake/late join/RESYNC.
            └── snake_pb2.py            # ROLE: [СГЕНЕРИРОВАНО] Python-модуль Protobuf.
```

---

## Тесты бэкенда: `backend/tests/`

```
backend/tests/
├── conftest.py                        # ROLE: Test isolation: temp CONFIG_PATH из fixtures/config_parity.json и очистка module-level runtime state.
├── fixtures/
│   └── config_parity.json             # ROLE: Pinned deterministic config для parity/isolation-тестов; не production-конфиг.
├── test_admin_audit.py                # ROLE: JSON audit login/config/restart: timestamp/event/ip/result/keys, отсутствие паролей, токенов и значений конфига.
├── test_admin_auth.py                 # ROLE: Тесты Admin API аутентификации: парсинг пароля, session-cookie, X-Real-IP за trusted proxy, spoofed XFF и bounded login limiter.
├── test_admin_config_schema.py        # ROLE: Контракт Pydantic-схемы PATCH /admin/config: parity с GameConfig, неизвестные ключи, типы и 422/400 на маршруте.
├── test_admin_restart.py              # ROLE: Тесты Admin API restart-потока: Protobuf restart-frame, ожидание/отмена соединений, draining-флаг.
├── test_admin_routes.py               # ROLE: Route-level tests публичных /health, /ready и admin session endpoints.
├── test_black_hole_timer.py           # ROLE: Таймеры чёрных дыр двигаются ровно один раз за тик.
├── test_boost.py                      # ROLE: Буст сохраняет score целым; late join после буста не ломает FULL-синк.
├── test_bots.py                       # ROLE: Lifecycle, live config sync, respawn, personalities и руление ботов.
├── test_client_messages.py            # ROLE: Лимит длины текстовых команд клиента.
├── test_config_example.py             # ROLE: Seed-шаблон config.example.json валиден для GameConfig; schema-версия хранится отдельным файлом.
├── test_config_persistence.py         # ROLE: Транзакционное сохранение конфига: backup, rollback apply/save, bind-mount fallback и 503 на admin-маршруте.
├── test_config_validation.py          # ROLE: Валидация конфига: finite, строгие int, диапазоны и fail-fast на битом config.json.
├── test_collision.py                   # ROLE: Тесты столкновений змейка-змейка.
├── test_dead_player_systems.py         # ROLE: Мёртвый игрок не двигается/ест/бустит и не ломает телепорт.
├── test_tombstones.py                  # ROLE: Уникальные ID после респавна и collision-radius надгробия.
├── test_events.py                      # ROLE: Тесты EventBus.
├── test_formula_parser.py              # ROLE: Тесты единого AST-движка формул роста: validation, runtime, differential и ошибки.
├── test_frame_parity.py                # ROLE: Parity-тест всех golden-сценариев кадра: deterministic protobuf vs .expected.json и .bin (транспорт), death/teleport/AoI transition/empty, initial/resync FULL equivalence.
├── test_gravity.py                     # ROLE: Тестирование системы гравитации (притяжения еды).
├── test_gravity_once_per_tick.py        # ROLE: Тест: гравитация чёрных дыр применяется к углу змейки ровно один раз за тик.
├── test_growth.py                      # ROLE: Тесты роста/усыхания змейки.
├── test_health_ready.py                # ROLE: Liveness `/health` всегда 200; readiness `/ready`/`/ws/ready` 503 при stale tick; tick-поля admin health и game_loop counters.
├── test_late_join.py                   # ROLE: Late-join FULL: initial vs resync equivalence, your_id/foods/seq и compress вне event loop.
├── test_live_config.py                 # ROLE: Live-config rebind: игроки/боты и Food/Portal/BlackHole видят новый config; respawn берёт новый start_length.
├── test_math_parity.py                 # ROLE: Parity-тест тороидальной математики. Сверяет Python с golden vectors.
├── test_physics.py                     # ROLE: Тесты физики движения.
├── test_player_session.py              # ROLE: Player session cookie/store и WS cookie-auth: флаги cookie, reuse, delete, TTL, cap, rate limit, reconnect identity, spectator isolation.
├── test_reconnect_race.py              # ROLE: Reconnect epoch, ownership FULL-send, delayed-remove vs новая сессия/grace-boundary, отмена pending, restart draining и отсутствие ghost.
├── test_resync.py                      # ROLE: Клиентский RESYNC: cooldown на соединение, дренаж очереди, ровно один FULL без шторма, PING/input не ломаются.
├── test_serialization_cache_race.py    # ROLE: Позднее подключение игрока не вызывает KeyError в кэше кадра.
├── test_server_resilience.py           # ROLE: Сбой сериализации одного клиента не убивает game loop.
├── test_spawn.py                       # ROLE: Стартовое тело заворачивается по ширине карты: край, map shrink, head-first parity с parity-сценарием.
├── test_spectator_identity.py          # ROLE: Cookie-auth identity; spectator не переиспользует player id; неудачный handshake не оставляет призрака.
├── test_test_isolation.py              # ROLE: Регрессии изоляции тестов: pinned config вместо backend/config.json и чистые module globals.
├── test_tick_events.py                 # ROLE: События на границе тика: очередь pending_removals, killfeed/food drop при disconnect, cleanup без death, reset/reconnect.
├── test_websocket_limits.py            # ROLE: Origin allowlist, per-IP bucket (включая denied origins), proxy-header trust, role caps и атомарный pending reservation.
├── test_websocket_queue.py             # ROLE: Backpressure sender-очереди: QueueStatus FULL/DELTA, coalescing FULL у медленного клиента, close 1011 при сбое sender.
├── test_world_lifecycle.py             # ROLE: Resize карты и полная очистка World.reset_state.
├── test_world_elements.py              # ROLE: Тесты порталов и чёрных дыр.
├── test_world_split.py                 # ROLE: Регрессии split World → ConfigStore/InputRouter/SnapshotService: proxies, wiring и instance-monkeypatch-точки.
├── frame_scenario.py                   # ROLE: Единые deterministic-сценарии кадра (default/empty): позиции, death/teleport/AoI transition/seam; build_scenario_frames для генератора и parity-тестов.
└── generate_frame_fixtures.py          # ROLE: Генерация эталонных кадров всех parity-сценариев (FULL + DELTA). Запуск вручную при изменении формата.
```

`backend/pyproject.toml` задаёт pytest (`testpaths`, `pythonpath`, async loop scope) и Ruff.

---

## Общие тестовые данные: `tests_shared/`

```
tests_shared/
├── snake.proto                     # ROLE: Protobuf-схема сетевого протокола обмена (Player.body/new_heads/length/final_length/body_truncated; frame_seq/server_tick кадра).
├── golden_vectors/
│   └── math.json                       # Эталонные векторы для тороидальной математики (25 кейсов).
└── golden_frames/
    ├── frame_full.bin                  # Сжатая транспортная фикстура FULL (zlib + Protobuf); не byte-golden.
    ├── frame_full.expected.json        # Ожидаемый FULL default-сценария: AoI, edge seam, dead, teleport, AoI transition.
    ├── frame_delta.bin                 # Сжатая транспортная фикстура DELTA (zlib + Protobuf); не byte-golden.
    ├── frame_delta.expected.json       # Ожидаемый DELTA default-сценария: death/teleport/AoI transition/just-respawned.
    ├── frame_empty_full.bin            # Сжатый FULL мира без игроков.
    ├── frame_empty_full.expected.json  # Ожидаемый FULL empty-сценария (players отсутствует).
    ├── frame_empty_delta.bin           # Сжатый DELTA мира без игроков.
    └── frame_empty_delta.expected.json # Ожидаемый DELTA empty-сценария (players отсутствует).
```

`.bin` — сжатые транспортные фикстуры для decoder round-trip. Parity сравнивает
**несжатый deterministic protobuf**, а не zlib-байты: вывод zlib зависит от
платформы/версии и эталоном не является.

---

## CI: `.github/`

```
.github/
└── workflows/
    ├── ci.yml                          # ROLE: CI: Ruff/Biome/tsc/pytest/vitest, audits, Docker builds + non-root/nginx checks on push/PR.
    └── release.yml                     # ROLE: CD: tag validation, GHCR publish (tag/sha/latest) and compose smoke; no host deploy.
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
