# ADR-004: Единое преобразование grid↔world и границы torus-математики

- **Status:** Accepted
- **Date:** 2026-11-02
- **Decision owners:** frontend/backend maintainers

## Context

Серверная симуляция хранит позиции в grid-единицах и использует
пространственную сетку с `CELL_SIZE = 10.0`. Клиент рендерит в world-единицах
с `gridSize = 20`. Раньше часть сущностей переводила координаты как
`grid * gridSize`, а игрок/еда/камера добавляли половину клетки; порталы и
чёрные дыры оказались смещены на 10 world units относительно collision. Кроме
того, torus-wrap был продублирован в нескольких файлах, что грозило
расхождением client/server на шве карты.

Нужно было зафиксировать одну формулу для центра клетки и отделить её от
тороидальной математики, которая обязана совпадать на TS и Python.

## Decision

1. **WorldMath — единственный grid↔world helper.** В
   `frontend/src/worker/shared/WorldMath.ts`:
   - `gridToWorldX(x) = x * gridSize + gridSize / 2`
   - `gridToWorldY(y) = -(y * gridSize + gridSize / 2)`
   - `worldToGridX/Y` — обратные преобразования;
   - `worldSizeFromGrid` — размер карты без half-cell.
   Все игроки, еда, порталы, чёрные дыры, tombstones, камера, миникарта и
   debug-рендер используют эти функции; локальные `+ gridSize / 2` в call
   sites не допускаются.
2. **Y инвертируется.** Положительный grid-Y соответствует отрицательному
   world-Y; это часть контракта рендера, а не деталь отдельного компьютера.
3. **Единицы не смешиваются.** Серверные позиции в кадре — grid-единицы.
   Клиентский world = `grid * gridSize` с half-cell через helper. Серверный
   `CELL_SIZE = 10.0` — только размер ячейки spatial index, не клиентский
   `gridSize`. Fog/AoI переводится как `world / 20` (то есть `/ gridSize`).
   Размеры карты берутся из `server_world`, а не из хардкода.
4. **Torus — отдельный слой.** `wrapNearest`/`wrapDelta`/`toroidalDelta`/
   `toroidalDistance`/`toroidalLerp` живут только в
   `frontend/src/worker/shared/MathUtils.ts`; Python-аналоги —
   `wrap_coordinate`/`wrap_delta`/`toroidal_delta`/`toroidal_distance` в
   `backend/app/engine/systems/math_utils.py`. `WorldMath` не выполняет wrap.
5. **Parity.** Любое изменение формул/edge-case (включая tie на ровно `w/2`)
   требует синхронного изменения TS и Python и зелёных golden vectors
   `tests_shared/golden_vectors/math.json`, а также parity-тестов.

## Consequences

**Положительные:**

- Центры порталов/ЧД совпадают с collision и остальными сущностями; исчезает
  сдвиг на полклетки.
- Один helper исключает расхождение между Food/Portal/BlackHole/камерой/
  миникартой.
- Torus-математика имеет один источник на каждом стеке и проверяется общими
  векторами.

**Отрицательные и ограничения:**

- `gridSize` и half-cell зашиты в контракт рендера; изменение требует
  синхронного обновления helper'ов, тестов и, возможно, визуальной приёмки.
- Серверный `CELL_SIZE` и клиентский `gridSize` — разные величины; их нельзя
  подставлять друг вместо друга, даже если оба равны 10/20 в текущем конфиге.
- Любой новый call site обязан импортировать helper, а не повторять формулу;
  code review должен ловить локальные `* gridSize`/`+ gridSize / 2`.
- `WorldMath` намеренно не делает wrap: смешение torus и grid-конверсии
  усложнило бы edge-case на шве.

## References

- [`frontend/src/worker/shared/WorldMath.ts`](../../frontend/src/worker/shared/WorldMath.ts)
- [`frontend/src/worker/shared/MathUtils.ts`](../../frontend/src/worker/shared/MathUtils.ts)
- [`backend/app/engine/systems/math_utils.py`](../../backend/app/engine/systems/math_utils.py)
- [`frontend/src/worker/shared/WorldMath.test.ts`](../../frontend/src/worker/shared/WorldMath.test.ts)
- [`frontend/src/worker/shared/MathUtils.parity.test.ts`](../../frontend/src/worker/shared/MathUtils.parity.test.ts)
- [`backend/tests/test_math_parity.py`](../../backend/tests/test_math_parity.py)
- [`tests_shared/golden_vectors/math.json`](../../tests_shared/golden_vectors/math.json)
- [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
