# Architecture Decision Records

> ROLE: Индекс принятых архитектурных решений проекта. Каждый ADR фиксирует
> контекст, решение и последствия; код и тесты остаются источником истины.

Формат: **Status / Context / Decision / Consequences**. Статус `Accepted`
означает, что решение реализовано и действует в текущем коде; `Superseded`
должен ссылаться на заменяющий ADR. ADR-001…ADR-005 фиксируют решения D1–D6
из [`REMEDIATION_PLAN.md`](../../REMEDIATION_PLAN.md); аддитивность D2 и
recovery D6 покрыты ADR-002.

| ADR | Решение | Статус |
|---|---|---|
| [ADR-001](ADR-001-session-auth.md) | Player identity через HttpOnly cookie; WS не доверяет query `client_id` | Accepted |
| [ADR-002](ADR-002-frame-sequencing.md) | `frame_seq`/`server_tick`, FULL-coalescing и `RESYNC` | Accepted |
| [ADR-003](ADR-003-config-ownership.md) | Единый владелец конфига, транзакционное сохранение и volume | Accepted |
| [ADR-004](ADR-004-grid-world-conversion.md) | Единое преобразование grid↔world и разделение torus-математики | Accepted |
| [ADR-005](ADR-005-tick-events.md) | События удаления на границе тика через `pending_removals` | Accepted |

Связанные документы:

- [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — потоки данных и инварианты.
- [`../../GAME_STATE.md`](../../GAME_STATE.md) — текущее состояние и ограничения.
- [`../../RUNBOOK.md`](../../RUNBOOK.md) — эксплуатация и восстановление.
- [`../../SECURITY.md`](../../SECURITY.md) — threat model и раскрытие уязвимостей.

## Как добавить ADR

1. Выберите следующий номер и скопируйте структуру существующего ADR.
2. Опишите именно решение и его границы, а не историю обсуждения.
3. Добавьте ссылки на затронутые файлы и тесты.
4. Обновите таблицу выше и `PROJECT_MAP.md`, если появился новый файл.
5. Не переписывайте старый Accepted ADR задним числом: создайте новый и
   пометьте старый `Superseded by ADR-NNN`.
