// ROLE: Pure toroidal math for the spectator follow camera. No DOM or Three.js.
export function shortestToroidalDelta(from: number, to: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) return to - from;

  let delta = (to - from) % size;
  if (delta > size / 2) delta -= size;
  else if (delta < -size / 2) delta += size;
  return delta;
}

/** Wrap a coordinate into [min, min + size). */
export function wrapWithin(value: number, size: number, min = 0): number {
  if (!Number.isFinite(size) || size <= 0) return value;
  return ((((value - min) % size) + size) % size) + min;
}
