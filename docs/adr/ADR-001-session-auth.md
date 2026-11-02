# ADR-001: Player identity через HttpOnly cookie

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decision owners:** backend/frontend maintainers

## Context

До remediation единственным credential игрока был публичный `client_id`,
который клиент присылал в query WebSocket и хранил в `localStorage`. Любой, кто
узнавал чужой UUID, мог подключиться под ним и захватить змейку. При этом
reconnect должен сохранять игрока, а spectator не должен переиспользовать
player identity: иначе открытие спектатора рвало бы соединение игрока и
оставляло змейку-призрака.

Нужно было разделить публичный `player_id` и секрет сессии, не добавляя
аккаунты/OAuth и не ломая Web Locks/takeover между вкладками.

## Decision

1. **Player session выдаётся сервером.** `POST /session` (алиас
   `/ws/session`) создаёт opaque token `secrets.token_urlsafe(32)` и
   устанавливает cookie `player_session`:
   `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` при HTTPS
   (`X-Forwarded-Proto: https` или HTTPS-схема запроса), `Max-Age` 30 дней.
   Токен не возвращается в JSON и не логируется.
2. **Store — in-memory.** Token → `{player_id, created_at, last_seen}`;
   абсолютный TTL 30 дней, cap 10 000 сессий, rate limit 30 запросов/мин на IP,
   периодическая очистка истёкших/самых старых. `DELETE /session` удаляет
   запись и очищает cookie.
3. **WS доверяет только cookie.** `client_id` из query оставлен для
   совместимости, игнорируется и пишет warning без значения. Валидная cookie
   даёт `player_id` и разрешает reconnect, если игрок ещё в мире; без/с
   невалидной cookie создаётся новый UUID.
4. **Spectator изолирован.** Для `role=spectator` cookie не резолвится,
   `last_seen` не обновляется, всегда выдаётся новый UUID. Player ID никогда не
   переиспользуется для spectator.
5. **Frontend не хранит identity.** Перед созданием player-worker вызывается
   `ensurePlayerSession()` с `credentials: "include"`; в WS URL нет
   `client_id`, legacy `snake_client_id` удаляется из `localStorage`.
   Spectator `/session` не вызывает. Наблюдаемый ID для E2E —
   `document.body.dataset.playerId`.
6. **Reconnect и takeover.** Cookie живёт в браузере, поэтому takeover через
   Web Locks/BroadcastChannel и повторное подключение используют ту же
   серверную сессию; epoch-логика WS не даёт старому handshake захватить новый.

Админская сессия (`admin_token`) — отдельный механизм; она не является player
cookie и описана в [`../../SECURITY.md`](../../SECURITY.md).

## Consequences

**Положительные:**

- UUID из query больше не является credential; hijack через чужой `client_id`
  невозможен.
- HttpOnly не даёт прочитать токен из JS; `SameSite=Lax` снижает CSRF-риск;
  `Secure` включается за HTTPS.
- Reconnect сохраняет змейку, spectator не вытесняет игрока, E2E получает
  стабильный наблюдаемый ID.

**Отрицательные и ограничения:**

- Сессии in-memory: рестарт backend инвалидирует cookie, и игрок получает новую
  identity. Это осознанно для single-process deployment.
- `POST /session` и WS должны работать same-origin в production; dev-схема
  `5173 → 8000` требует CORS с credentials и точного `ALLOWED_ORIGINS`.
- Нет серверной ротации/отзыва отдельного player-token; logout удаляет cookie и
  запись, а подозрительная сессия требует реакции на уровне браузера/деплоя.
- За reverse proxy без `X-Forwarded-Proto` cookie не получит `Secure`; TLS и
  корректные заголовки обязательны.

## References

- [`backend/app/api/session.py`](../../backend/app/api/session.py)
- [`backend/app/api/websocket.py`](../../backend/app/api/websocket.py)
- [`frontend/src/game/NetworkManager.ts`](../../frontend/src/game/NetworkManager.ts)
- [`frontend/src/worker/WebSocketClient.ts`](../../frontend/src/worker/WebSocketClient.ts)
- [`backend/tests/test_player_session.py`](../../backend/tests/test_player_session.py)
- [`backend/tests/test_spectator_identity.py`](../../backend/tests/test_spectator_identity.py)
