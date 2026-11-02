# ADR-002: Frame sequencing, FULL-coalescing и RESYNC

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decision owners:** netcode maintainers

## Context

Клиент получал FULL при handshake и затем DELTA. Без номера кадра он не мог
отличить пропуск от нормальной последовательности, а ошибка декодирования
оставляла его на устаревшем состоянии. При медленном клиенте one-slot
sender-очередь могла выбросить DELTA, и следующий DELTA применялся поверх
потерянного изменения. Повторная сборка FULL на каждом тике давала бы
FULL-шторм и лишнюю нагрузку на CPU.

Нужен аддитивный протокол, совместимый со старыми клиентами, с явным способом
обнаружить разрыв и восстановиться.

## Decision

1. **Поля кадра.** В `GameStateFrame` добавлены optional `frame_seq = 19` и
   `server_tick = 20`. Это поля кадра, а не игрока; их нельзя путать с
   `server_tick_rate = 2`. `frame_seq` — uint32.
2. **Один seq на тик.** `game.tick` увеличивает `server_tick` и присваивает
   `frame_seq = server_tick` ровно один раз после систем. Все FULL/DELTA/config
   broadcast одного тика и все клиенты видят одинаковое значение.
   `process_client` только читает уже вычисленный seq. `reset_state()`
   сбрасывает оба счётчика; после рестарта клиент видит разрыв.
3. **Один FULL-writer.** Handshake, late join и RESYNC используют
   `build_full_frame`; initial snapshot собирается в event loop, а
   `zlib.compress(level=1)` уходит в `asyncio.to_thread`. FULL и DELTA
   одного тика не могут разойтись по seq/`your_id`/foods.
4. **Backpressure без шторма.** Sender-очередь хранит один кадр.
   `QueueStatus.REPLACED_DELTA` означает потерю DELTA и требует FULL;
   `REPLACED_FULL` и `DROPPED_DELTA_FULL_PENDING` не запускают повторную
   сборку, потому что FULL уже является точкой восстановления. При полной
   очереди и `needs_full_sync` новый FULL не строится до drain.
5. **RESYNC.** Клиент отправляет текстовый `RESYNC`, если `frame_seq` не равен
   `lastSeq + 1` (с учётом uint32 wrap) или декодирование/декомпрессия упали.
   Сервер ставит `needs_full_sync=True`, дренирует one-slot очередь и
   ограничивает запросы cooldown'ом 1 с на соединение; `resync_epoch` защищает
   запрос, пришедший во время сборки кадра. Клиент также имеет cooldown 1 с.
   `RESYNC` — control-сообщение, а не игровой ввод; `SEND` с этой строкой
   отбрасывается.
6. **Клиентская последовательность.** FULL открывает/сбрасывает цепочку,
   DELTA применяется только при точном `(lastSeq + 1) >>> 0`; DELTA до первого
   FULL игнорируется, DELTA без `frame_seq` считается legacy и принимается.
   `SERVER_RESTART` и неизвестные типы не применяются. Ошибка декодирования
   инвалидирует цепочку и не коммитит состояние.

## Consequences

**Положительные:**

- Потеря DELTA, битый кадр и рестарт обнаруживаются детерминированно; клиент
  восстанавливается через FULL, а не «продолжает как получится».
- Все клиенты одного тика имеют одинаковый seq; late join и resync FULL
  эквивалентны по содержимому.
- FULL-coalescing и cooldown'ы ограничивают FULL-шторм на медленных клиентах.

**Отрицательные и ограничения:**

- Обнаружение разрыва занимает как минимум один кадр; восстановление стоит
  FULL-кадра и дополнительного CPU/трафика.
- Cooldown 1 с означает, что повторный сбой в течение секунды не вызовет новый
  FULL; клиент может оставаться на старом состоянии до истечения окна.
- Поля optional: старый клиент без `frame_seq` не обнаруживает разрыв, а
  сервер не обязан поддерживать его вечно. Любое изменение семантики полей
  требует нового ADR и golden-фикстур.
- `frame_seq` — scoped к одному `World`/процессу; при нескольких репликах
  последовательность не будет общей.

## References

- [`tests_shared/snake.proto`](../../tests_shared/snake.proto)
- [`backend/app/engine/game.py`](../../backend/app/engine/game.py)
- [`backend/app/engine/systems/serialization.py`](../../backend/app/engine/systems/serialization.py)
- [`backend/server.py`](../../backend/server.py)
- [`backend/app/api/websocket.py`](../../backend/app/api/websocket.py)
- [`frontend/src/worker/WebSocketClient.ts`](../../frontend/src/worker/WebSocketClient.ts)
- [`frontend/src/worker/DeltaDecoder.ts`](../../frontend/src/worker/DeltaDecoder.ts)
- [`backend/tests/test_frame_parity.py`](../../backend/tests/test_frame_parity.py)
- [`backend/tests/test_resync.py`](../../backend/tests/test_resync.py)
- [`backend/tests/test_websocket_queue.py`](../../backend/tests/test_websocket_queue.py)
