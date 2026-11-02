# ADR-005: События удаления на границе тика

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decision owners:** backend maintainers

## Context

`kill_events` и `new_foods` — transient-события, которые очищаются в начале
тика и живут до broadcast. Если игрок отключался между тиками и удалялся
напрямую из connection lifecycle, смерть и выпавшая еда могли быть стёрты
очисткой следующего тика: killfeed терял запись, еда не появлялась в кадре.
При этом cleanup неудачного handshake не должен считаться смертью и попадать в
killfeed.

Нужен один путь удаления, привязанный к границе тика, и отдельный путь для
identity, которая никогда не играла.

## Decision

1. **Единая очередь `pending_removals`.** `World.queue_player_removal()`
   добавляет ID в set; `World.process_pending_removals()` применяет удаления.
   Connection lifecycle не удаляет игрока напрямую.
2. **Порядок в `game.tick`.** Сначала очищаются transient-события тика
   (`food_manager.tick_start()` и `kill_events = []`), **затем** применяются
   `pending_removals` до систем. Поэтому смерть/выпадение еды от disconnect
   между тиками попадают в тот же кадр, а не стираются на старте следующего.
3. **Reconnect отменяет удаление.** `_handle_reconnection` вызывает
   `cancel_pending_removal`; если удаление уже успело примениться в окне
   `accept()`, игрок создаётся заново, а не остаётся socket без тела.
   `delayed_remove` после grace-периода только enqueue-ит удаление.
4. **Failed handshake не убивает.** Cleanup неудачного handshake, restart-reject
   и claim-failure используют `remove_player(..., emit_death=False)`: identity
   удаляется без `player_died`, killfeed и food drop. Это не «смерть» и не
   должно влиять на игру.
5. **Reset очищает очередь.** `World.reset_state()` очищает
   `pending_removals` вместе с игроками, едой, элементами мира, tombstones,
   spectators, input queue и per-tick caches; restart не должен оставлять
   «отложенную смерть» из старого мира.

## Consequences

**Положительные:**

- Disconnect между тиками не теряет killfeed/food drop; события принадлежат
  тому тику, который их broadcast'ит.
- Нет второго параллельного механизма удаления, который мог бы обойти
  `pending_removals`.
- Неудачный handshake/restart не создаёт призраков и ложных kill-событий.

**Отрицательные и ограничения:**

- Удаление после disconnect откладывается до следующего тика (плюс
  `RECONNECT_GRACE_SECONDS`); это осознанная задержка ради корректных событий.
- `pending_removals` — set, поэтому повторный enqueue идемпотентен; код не
  должен рассчитывать на порядок удаления внутри одного тика.
- События всё ещё живут только до broadcast; поздний клиент получает состояние,
  а не историю killfeed (история — отдельный слой UI/телеметрии).
- `reset_state()` обязан оставаться полным; добавление нового per-tick события
  требует явной очистки, иначе оно переживёт restart.

## References

- [`backend/app/engine/game.py`](../../backend/app/engine/game.py)
- [`backend/app/engine/state.py`](../../backend/app/engine/state.py)
- [`backend/app/engine/food_manager.py`](../../backend/app/engine/food_manager.py)
- [`backend/app/api/websocket.py`](../../backend/app/api/websocket.py)
- [`backend/tests/test_tick_events.py`](../../backend/tests/test_tick_events.py)
- [`backend/tests/test_world_lifecycle.py`](../../backend/tests/test_world_lifecycle.py)
- [`backend/tests/test_reconnect_race.py`](../../backend/tests/test_reconnect_race.py)
