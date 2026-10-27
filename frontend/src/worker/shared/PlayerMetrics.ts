// ROLE: Pure player-size math shared by food/fog calculations. No rendering.

import type { GameState } from "../../types/game";

export function getBodySegmentCount(body: number[] | undefined, fallback = 0): number {
  if (!body) return fallback;
  return Math.floor(body.length / 2);
}

export function getStartLength(state: GameState, fallback = 9): number {
  return state.server_snake?.start_length ?? fallback;
}

export function computeHeadRadiusWorld(
  state: GameState,
  body: number[] | undefined,
  gridSize: number,
): number {
  const startLength = getStartLength(state);
  const segments = getBodySegmentCount(body, startLength);
  const gained = Math.max(0, segments - startLength);
  const base = state.server_snake?.base_head_radius ?? 0.2;
  const scale = state.server_snake?.score_thickness_scale ?? 0.0005;
  return (base + gained * 10.0 * scale) * gridSize;
}

export function computeFogRadiusWorld(
  state: GameState,
  body: number[] | undefined,
  infinite: boolean,
): number {
  if (infinite) return 1_000_000.0;
  const startLength = getStartLength(state);
  const segments = getBodySegmentCount(body, startLength);
  const gained = Math.max(0, segments - startLength);
  const minRadius = state.server_visual?.min_fog_radius ?? 900.0;
  const expansion = state.server_visual?.fog_score_expansion_coeff ?? 0.5;
  return minRadius + gained * 10.0 * expansion;
}
