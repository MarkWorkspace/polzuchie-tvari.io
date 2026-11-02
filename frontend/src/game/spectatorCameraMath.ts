// ROLE: Тонкие обёртки follow-камеры спектатора над shared MathUtils (wrapDelta/wrapNearest).
// Своей тороидальной математики не содержит; не знает про DOM, Three.js и состояние игры.

import { wrapDelta, wrapNearest } from "../worker/shared/MathUtils";

/** Shortest signed toroidal delta from `from` to `to`; exact half keeps its sign. */
export function shortestToroidalDelta(from: number, to: number, size: number): number {
  return wrapDelta(to - from, size);
}

/** Wrap a coordinate into [min, min + size). Invalid sizes return the value unchanged. */
export function wrapWithin(value: number, size: number, min = 0): number {
  if (!Number.isFinite(size) || size <= 0) return value;
  return wrapNearest(value - min, size) + min;
}
