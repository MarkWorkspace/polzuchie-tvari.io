// ROLE: Тороидальные операции, lerp. ЕДИНСТВЕННАЯ копия математики на фронте.

export const frameSmoothing = (smoothingAt20Hz: number, dt: number): number => {
  return 1 - Math.pow(1 - smoothingAt20Hz, dt / 0.05);
};

export const randomRange = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

export const toroidalDelta = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
): [number, number] => {
  let dx = x2 - x1;
  if (dx > width / 2) dx -= width;
  else if (dx < -width / 2) dx += width;

  let dy = y2 - y1;
  if (dy > height / 2) dy -= height;
  else if (dy < -height / 2) dy += height;

  return [dx, dy];
};

export const toroidalDistance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
): number => {
  const [dx, dy] = toroidalDelta(x1, y1, x2, y2, width, height);
  return Math.sqrt(dx * dx + dy * dy);
};

export const lerpAngle = (a: number, b: number, t: number): number => {
  let da = (b - a) % (Math.PI * 2);
  if (da > Math.PI) da -= Math.PI * 2;
  else if (da < -Math.PI) da += Math.PI * 2;
  return a + da * t;
};

export const toroidalLerp = (
  x1: number,
  x2: number,
  t: number,
  size: number
): number => {
  let dx = x2 - x1;
  if (dx > size / 2) dx -= size;
  else if (dx < -size / 2) dx += size;
  let result = x1 + dx * t;
  if (result < 0) result += size;
  else if (result >= size) result -= size;
  return result;
};

export const writeMatrix = (
  array: Float32Array,
  index: number,
  tx: number,
  ty: number,
  tz: number,
  s: number
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
