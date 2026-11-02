# SECURITY: Polzuchie-tvari.io

> ROLE: Политика сообщения об уязвимостях и threat model текущего
> single-process Docker-развёртывания. Не является гарантией безопасности и не
> заменяет code review, dependency audit и настройку edge-прокси.

Операционные процедуры — в [`RUNBOOK.md`](RUNBOOK.md), архитектурные решения —
в [`docs/adr/README.md`](docs/adr/README.md).

## 1. Supported versions

Проект не публикует LTS-ветки и семантические security-релизы. Поддерживается
только текущий commit, развёрнутый в production, и актуальное состояние ветки
разработки, из которой этот commit собран. Старые commits, форки и
самостоятельные модификации не получают backport'ов и не покрываются этой
политикой.

| Версия | Поддержка |
|---|---|
| Текущий production commit и соответствующая ветка разработки | Исправления безопасности выходят в текущую линию; обновление — через deploy по `RUNBOOK.md`. |
| Старые commits, теги и форки | Не поддерживаются; backport'ы не обещаются. |
| Локальные модификации и сторонние сборки | Ответственность владельца сборки; воспроизводите проблему на текущем commit. |

Практические следствия:

- Обновляйте deployment из доверенного commit/тега и пересобирайте образы;
  base images закреплены digest'ами, поэтому mutable tag не подтянет произвольный
  образ.
- Перед обновлением сохраняйте runtime-конфиг и проверяйте `/ready` по
  [`RUNBOOK.md`](RUNBOOK.md).
- Версия в `backend/pyproject.toml`/`frontend/package.json` — техническая
  метаданные, а не контракт поддержки.

## 2. Как сообщить об уязвимости

**Не открывайте публичный GitHub issue, discussion или pull request с деталями
эксплойта.** Используйте private security advisory в GitHub-репозитории проекта:
**Repository → Security → Advisories → New draft security advisory**. Если
private advisory недоступен, свяжитесь с мейнтейнером через приватный канал,
указанный в профиле репозитория; специального email в этом документе намеренно
нет, чтобы не публиковать вымышленный или устаревший адрес.

В отчёте укажите:

- затронутый commit/ветку и способ развёртывания (compose/edge-прокси);
- тип проблемы и ожидаемое влияние (hijack, admin takeover, XSS, DoS,
  утечка секрета, обход лимита и т.п.);
- минимальную воспроизводимую последовательность на **локальном** стенде;
- конфигурацию, версии браузера/ОС, relevant logs **без** паролей, cookie,
  session-токенов и значений runtime-конфига;
- известные ограничения и предложение по исправлению, если есть.

Что мы делаем: подтверждаем получение в приватном канале, воспроизводим на
изолированном стенде, готовим fix и координируем раскрытие после выпуска
исправления. Конкретный SLA и bug bounty не обещаются. Пожалуйста, не проводите
DoS/DDoS, destructive-тесты или социальную инженерию против production;
используйте локальный compose-стенд.

## 3. Модель развёртывания и доверенные границы

Ожидаемая production-схема:

```text
Интернет → TLS edge → frontend nginx :3000 → backend :8000 → volume backend_config
```

Доверенные компоненты:

- edge-прокси и хост Docker (root на хосте может читать volume и менять
  контейнеры);
- backend и его in-memory state;
- оператор с доступом к админке и `.env`.

Не доверяем: входным HTTP/WS-заголовкам от браузера, query-параметрам,
никнеймам, содержимому игровых сообщений, cookie до проверки сессии,
IP-заголовкам при выключенном `TRUST_PROXY_HEADERS`, а также хосту, если
backend опубликован напрямую.

Ключевые предположения:

- backend и frontend слушают только loopback; наружу смотрит TLS-терминатор;
- `ADMIN_PASSWORD` задан, хранится вне git и не равен `change-me`;
- `ALLOWED_ORIGINS` содержит только реальные публичные origin;
- volume не доступен недоверенным пользователям хоста;
- один backend-процесс (in-memory сессии и мир не разделяются между репликами).

## 4. Threat model

### 4.1. Player session

**Актив:** возможность продолжить/захватить конкретную змейку и её статистику.

**Угрозы:** кража или подделка `client_id`; fixation; переиспользование
spectator'ом player identity; утечка токена через JS/логи; CSRF на
`POST /session`.

**Текущие меры:**

- `POST /session` выдаёт opaque token (`secrets.token_urlsafe(32)`) в cookie
  `player_session`; cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` при
  HTTPS (`X-Forwarded-Proto: https` или `request.url.scheme`), TTL 30 дней.
- Сервер хранит token → `{player_id, created_at, last_seen}` в памяти; cap
  10 000, rate limit 30 запросов/мин на IP, периодическая очистка истёкших.
- WS не доверяет query `client_id`: он игнорируется (с warning), identity
  берётся только из cookie. Без/с истёкшей cookie создаётся новый UUID.
- Spectator никогда не резолвит player-cookie и всегда получает новый UUID;
  player ID не переиспользуется.
- `DELETE /session` удаляет серверную сессию и очищает cookie; токен не
  возвращается в JSON и не пишется в audit-лог.

**Остаточные риски:** XSS на странице может отправлять запросы от имени
пользователя, хотя не может прочитать HttpOnly cookie; без HTTPS cookie не
получает `Secure`; in-memory store теряет сессии при рестарте (это приводит к
новой identity, а не к компрометации); нет серверной ротации токена по
подозрению — реакция ограничена logout/удалением cookie. Rate limit
`POST /session` использует `X-Forwarded-For`/`X-Real-IP` без отдельного
trust-gate, поэтому безопасен только при закрытом backend за nginx; при прямом
доступе к `:8000` bucket можно обойти подделкой заголовка. Не публикуйте
backend напрямую.

### 4.2. WebSocket handshake: Origin, лимиты и identity

**Актив:** слот подключения, игровой мир, честность лидерборда, доступность.

**Угрозы:** cross-site WebSocket hijacking, spectator/player flood, перебор
handshake, отправка огромных/частых сообщений, takeover чужой сессии,
переиспользование spectator ID.

**Текущие меры:**

- Точный `Origin` allowlist (`ALLOWED_ORIGINS`, scheme://host:port,
  case-insensitive, без wildcard); CORS REST использует тот же список.
  Отсутствие `Origin` разрешено для CLI/тестов, `Origin: null` и чужой origin
  отклоняются.
- Per-IP token bucket `WS_HANDSHAKE_RATE_LIMIT=30` за
  `WS_HANDSHAKE_WINDOW_SECONDS=10`; ключ — `X-Real-IP`/первый
  `X-Forwarded-For` только при доверенном proxy, иначе socket peer.
- Role caps: `MAX_PLAYER_CONNECTIONS=50`, `MAX_SPECTATOR_CONNECTIONS=100`;
  spectator не занимает player-слот; takeover существующего игрока не
  расходует новый слот. Admission использует атомарный pending-reservation.
- Отказы: `1008` (Origin), `4002` (player cap), `4003` (spectator cap),
  `4029` (per-IP); сбой sender закрывает соединение `1011`, restart/drain —
  `1012`. Cookie-auth и epoch-логика не дают старому handshake захватить нового.
- Входящие текстовые команды ограничены 32 символами, обрабатываются не чаще
  50/с; `ws_max_size=4096`, `permessage-deflate` выключен.

**Остаточные риски:** Origin — не аутентификация; не-браузерный клиент может
не прислать Origin и подключиться с новой identity. Volumetric DDoS,
TLS-handshake flood и исчерпание полосы пропускания не решаются приложением;
для публичного запуска нужен edge/WAF/rate limit.
Если несколько клиентов приходят через один прокси и real-IP не настроен, все
они делят один handshake-bucket (см. §6 и RUNBOOK §9).

### 4.3. Admin access и audit

**Актив:** runtime-конфиг, restart, игровой баланс, операционные данные.

**Угрозы:** подбор пароля, кража admin-cookie, CSRF, spoofing `X-Forwarded-For`,
секреты в логах, забытая открытая админка.

**Текущие меры:**

- `POST /admin/login` сравнивает пароль через `hmac.compare_digest`, выдаёт
  серверную HttpOnly cookie `admin_token` (`SameSite=Strict`, `Secure` при
  HTTPS, TTL 12 часов, `Path=/`). Пароль не хранится в `localStorage` и не
  передаётся в custom headers.
- Login rate limit 10 попыток за 5 минут на ключ; ключ — только `X-Real-IP` при
  доверенном proxy, иначе socket peer. `X-Forwarded-For` для admin login не
  используется. Словарь bucket'ов ограничен 10 000.
- Login/config/restart пишут JSON audit: `timestamp`, `event`, `ip`, `result`,
  для config — только верхнеуровневые `keys`. Пароли, токены и значения
  конфига не логируются.
- В production без `ADMIN_PASSWORD` admin API отвечает `403`; dev-пароль
  `admin` действует только вне production и не должен попадать в production.

**Остаточные риски:** нет 2FA; admin-сессия хранится в памяти и живёт только
до рестарта; SameSite/Origin снижают CSRF-риск, но отдельного CSRF-token нет;
если `TRUST_PROXY_HEADERS=0` за nginx, все admin login попытки схлопываются в
один bucket, а если `1` без доверенного proxy — IP можно подделать. Аудит
хранится в stdout/json-file логах с ротацией, без неизменяемого SIEM-хранилища.

### 4.4. Runtime config и volume

**Актив:** игровой баланс, карта, еда, порталы/чёрные дыры, боты, seed.

**Угрозы:** подмена файла, ownership drift после `docker compose cp`, случайное
удаление volume, сохранение невалидного конфига, утечка операционных значений.

**Текущие меры:**

- `config.json` не в git; `config.example.json` — только seed; entrypoint
  копирует seed лишь в пустой volume и не перезаписывает live-файл/`.bak`.
- Backend работает non-root (`appuser`); entrypoint проверяет записываемость
  каталога/файла и завершает старт с понятной ошибкой при ownership mismatch.
- `World.update_config` валидирует deep-copy, применяет live, затем делает
  `.bak`, пишет через `os.replace` с fallback для single-file mount и
  откатывает память/файл при ошибке; HTTP отдаёт `400`/`503`, не `500`.
- Live-обновление перепривязывает `Player.config` и пересчитывает производные
  радиусы Food/Portal/BlackHole; `apply_config` не переролливает позиции без
  необходимости.
- `config.schema-version` — отдельный маркер; автоматических миграций нет.

**Остаточные риски:** файл имеет режим `0644` и доступен пользователям хоста с
доступом к volume; это не секретное хранилище. Ручное редактирование обходит
Pydantic, audit и backup. `.bak` — только предыдущая версия, а не долгий архив.
`docker compose down -v` уничтожает live-конфиг. Rollback после resize/apply
best-effort: удалённая еда и пересозданные позиции порталов/ЧД могут не
восстановиться.

### 4.5. XSS, CSP и контент

**Актив:** браузерная сессия игрока/админа, UI, никнеймы, debug-панели.

**Угрозы:** injection через nickname/ID/имена сущностей, вредоносный SVG/asset,
ослабление CSP, кликджекинг.

**Текущие меры:**

- React экранирует текст по умолчанию; untrusted-строки в legacy debug-overlay
  проходят через `escapeHtml`; статическая разметка `main.ts` не содержит
  пользовательских данных.
- nginx отдаёт CSP `default-src 'self'; script-src 'self'; ...;
  object-src 'none'; base-uri 'self'; frame-ancestors 'none'`, а также
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  HSTS. Inline-script запрещён; inline-style разрешён для существующего UI.
- `connect-src` содержит `'self' ws: wss:`; worker — `'self' blob:`; images —
  `'self' data: blob:`.

**Остаточные риски:** `ws:`/`wss:` в CSP разрешают подключение к произвольному
WS-origin (не только same-origin), а inline-style остаётся разрешённым. CSP не
является заменой экранированию и review. Сторонние assets/шрифты должны
оставаться self-hosted; добавление CDN потребует осознанного изменения CSP.

### 4.6. DoS и доступность

**Актив:** игровой цикл, CPU/RAM backend, слоты WS, ingress.

**Угрозы:** flood handshake, spectator flood, медленные клиенты с FULL-штормом,
огромные тела запросов, OOM, дорогие конфиг-патчи, DDoS.

**Текущие меры:**

- per-IP handshake bucket, role caps, takeover без лишнего слота;
- один слот sender-очереди, `QueueStatus`, RESYNC cooldown 1 с на клиенте и
  сервере; FULL coalescing вместо повторной сборки;
- `ws_max_size=4096`, 32-символьные команды, лимит 50 команд/с;
- nginx `client_max_body_size 64k`, таймауты WS, лимиты compose
  (backend 1.5 CPU/1G, frontend 0.8 CPU/512M), json-file rotation;
- `/health` отделён от `/ready`, поэтому короткий stale tick не вызывает
  рестарт контейнера по Docker healthcheck.

**Остаточные риски:** приложение не заменяет edge-защиту от volumetric DDoS;
single-process не масштабируется горизонтально; FULL-шторм и дорогая
сериализация возможны при аномальных клиентах; нет WAF, CAPTCHA и
централизованного rate limit на edge. После OOM контейнер перезапускается, но
in-memory игра и сессии теряются.

### 4.7. Секреты и supply chain

**Актив:** `ADMIN_PASSWORD`, session-токены в памяти, образы, lockfiles.

**Текущие меры:** `.env`/`.env.*` в `.gitignore` (кроме `.env.example`);
`ADMIN_PASSWORD` передаётся compose через env, не логируется; токены
генерируются CSPRNG; base images закреплены digest'ами; CI запускает
`pip-audit` и `npm audit`, Dependabot обновляет зависимости; образы работают
non-root.

**Остаточные риски:** секреты видны процессу/хосту и могут попасть в
`docker inspect`; нет vault/secret manager и автоматической ротации; audit
зависимостей не равен отсутствию уязвимостей; supply-chain compromise хоста
или registry выходит за границы приложения.

## 5. Security-relevant configuration

| Переменная | Безопасное значение |
|---|---|
| `ADMIN_PASSWORD` | Длинный уникальный секрет; не `change-me`, не в git, не в логах. |
| `ALLOWED_ORIGINS` | Точный HTTPS-origin(ы), без wildcard; пустое значение отключает браузерные origin. |
| `TRUST_PROXY_HEADERS` | `1` только если backend недоступен напрямую и proxy перезаписывает `X-Real-IP`; иначе `0`. |
| `ENVIRONMENT` | `production` в production (иначе admin fallback и dev-поведение). |
| `CONFIG_PATH` | `/app/data/config.json` в compose; не указывать на git-tracked файл. |
| `MAX_PLAYER_CONNECTIONS` / `MAX_SPECTATOR_CONNECTIONS` | По ёмкости; не поднимать без CPU/RAM-проверки. |
| `WS_HANDSHAKE_RATE_LIMIT` / `WS_HANDSHAKE_WINDOW_SECONDS` | Не ослаблять без edge-защиты и корректного real-IP. |
| `LOG_LEVEL` | `INFO` или выше; `DEBUG` может увеличить объём логов. |

## 6. Known limitations и что делать перед публичным запуском

1. **TLS обязателен на edge.** Внутри compose трафик HTTP; без HTTPS cookie не
   получают `Secure`, а токены и игровые сообщения идут открыто по сети.
   Убедитесь, что edge передаёт `X-Forwarded-Proto: https`.
2. **Real-IP за двойным прокси.** Текущий frontend nginx перезаписывает
   `X-Real-IP` адресом непосредственного peer. Если перед ним стоит ещё один
   proxy, per-IP лимиты схлопнутся; настройте `real_ip` или направляйте `/ws`
   напрямую в backend (см. RUNBOOK §9.2).
3. **Single process.** Нет shared session store и горизонтального масштабирования;
   несколько реплик за балансировщиком дадут разные миры/сессии.
4. **In-memory sessions.** Рестарт инвалидирует player/admin-сессии; это
   ожидаемое ограничение, а не механизм отзыва отдельного токена.
5. **Нет 2FA, CSRF-token, WAF и immutable audit.** Для повышенных требований
   это нужно добавить отдельными задачами, а не «настройкой» runbook.
6. **Нет автоматических миграций конфига.** Несовместимая схема требует
   ручного переноса; не копируйте старый volume поверх нового кода вслепую.

## 7. Out of scope

Аккаунты/OAuth/2FA, multi-tenant auth, CDN/WAF, Kubernetes, at-rest encryption
volume, SIEM/долгосрочное хранение audit, формальная программа bug bounty и
юридические гарантии safe harbor. Эти темы не считаются закрытыми текущими
мерами и требуют отдельного решения владельца проекта.
