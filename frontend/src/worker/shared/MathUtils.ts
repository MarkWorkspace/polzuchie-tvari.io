// ROLE: Единственный источник тороидальной математики на фронте: wrapNearest, wrapDelta,
// toroidalDelta/toroidalDistance, toroidalLerp, randomRange и writeMatrix. Не знает про сеть, рендер и состояние игры.

export const randomRange = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

/**
 * Wraps a coordinate into `[0, size)`.
 *
 * Non-finite values and non-positive/non-finite sizes are returned unchanged:
 * callers that need a numeric fallback (e.g. decor cells) guard first.
 */
export const wrapNearest = (value: number, size: number): number => {
  if (!(size > 0) || !Number.isFinite(size) || !Number.isFinite(value)) return value;
  return ((value % size) + size) % size;
};

/**
 * Shortest signed delta on a torus of the given size.
 *
 * Exact half-size ties keep the sign of the input (`+size / 2` stays positive,
 * `-size / 2` stays negative), matching `toroidalDelta` and the backend
 * `wrap_delta`/golden vectors. Invalid sizes and non-finite deltas return the
 * delta unchanged.
 */
export const wrapDelta = (delta: number, size: number): number => {
  if (!(size > 0) || !Number.isFinite(size) || !Number.isFinite(delta)) return delta;
  const reduced = delta % size;
  if (reduced > size / 2) return reduced - size;
  if (reduced < -size / 2) return reduced + size;
  return reduced;
};

export const toroidalDelta = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): [number, number] => {
  return [wrapDelta(x2 - x1, width), wrapDelta(y2 - y1, height)];
};

export const toroidalDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): number => {
  const [dx, dy] = toroidalDelta(x1, y1, x2, y2, width, height);
  return Math.sqrt(dx * dx + dy * dy);
};

export const toroidalLerp = (x1: number, x2: number, t: number, size: number): number => {
  return wrapNearest(x1 + wrapDelta(x2 - x1, size) * t, size);
};

export const writeMatrix = (
  array: Float32Array,
  index: number,
  tx: number,
  ty: number,
  tz: number,
  s: number,
): void => {
  const idx = index * 16;
  array[idx + 0] = s;
  array[idx + 1] = 0;
  array[idx + 2] = 0;
  array[idx + 3] = 0;

  array[idx + 4] = 0;
  array[idx + 5] = s;
  array[idx + 6] = 0;
  array[idx + 7] = 0;

  array[idx + 8] = 0;
  array[idx + 9] = 0;
  array[idx + 10] = s;
  array[idx + 11] = 0;

  array[idx + 12] = tx;
  array[idx + 13] = ty;
  array[idx + 14] = tz;
  array[idx + 15] = 1;
};
