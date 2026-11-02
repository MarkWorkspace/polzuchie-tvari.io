// ROLE: Единое преобразование координат серверной сетки в world-space и обратно. Не выполняет тороидальный wrap (см. MathUtils).

/**
 * Мировые координаты серверной сетки.
 *
 * Серверные координаты заданы в клетках карты. Центр клетки `x` находится в
 * world-space на половину клетки правее её левой границы, поэтому все позиции
 * сущностей (игроки, еда, порталы, чёрные дыры, камера, tombstones) обязаны
 * проходить через эти функции. Размеры карты и радиусы используют
 * `worldSizeFromGrid()` или умножение на `gridSize` без half-cell.
 */
export const gridToWorldX = (x: number, gridSize: number): number => {
  return x * gridSize + gridSize / 2;
};

/** То же, что `gridToWorldX`, но с инверсией оси Y (серверный Y растёт вниз). */
export const gridToWorldY = (y: number, gridSize: number): number => {
  return -(y * gridSize + gridSize / 2);
};

/** Обратное преобразование world X → серверная сетка. */
export const worldToGridX = (wx: number, gridSize: number): number => {
  return (wx - gridSize / 2) / gridSize;
};

/** Обратное преобразование world Y → серверная сетка. */
export const worldToGridY = (wy: number, gridSize: number): number => {
  return (-wy - gridSize / 2) / gridSize;
};

/** Размер участка карты в world units без half-cell (для wrap и размеров). */
export const worldSizeFromGrid = (n: number, gridSize: number): number => {
  return n * gridSize;
};
