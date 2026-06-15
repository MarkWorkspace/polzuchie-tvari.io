// ROLE: Матрицы инстансов чёрных дыр.

import type { GameState } from "../types/game";
import { writeMatrix } from "./shared/MathUtils";

export interface BlackHoleBuffers {
  blackHoleCoreMatrices: Float32Array;
  blackHoleRingMatrices: Float32Array;
  blackHoleGravityMatrices: Float32Array;
  blackHoleCount: number;
}

export function computeBlackHoles(
  state: GameState,
  lastState: GameState | null,
  progress: number,
  camX: number,
  camY: number,
  fogRadiusWorld: number,
  gridSize: number
): BlackHoleBuffers {
  const blackHoles = state.black_holes || [];
  const lastBhMap = _buildLastBhMap(lastState);
  const visibleBlackHoles: { wx: number; wy: number; pullRadius: number; killRadius: number }[] = [];

  if (state.server_world?.black_holes_enabled !== 0) {
    for (const bh of blackHoles) {
      const scale = bh.current_scale ?? 1.0;
      let pullRadius = bh.pull_radius * scale;
      let killRadius = bh.kill_radius * scale;

      const lastBh = lastBhMap.get(bh.id);
      if (lastBh) {
        const lastScale = lastBh.current_scale ?? 1.0;
        pullRadius = (lastBh.pull_radius * lastScale) + (pullRadius - lastBh.pull_radius * lastScale) * progress;
        killRadius = (lastBh.kill_radius * lastScale) + (killRadius - lastBh.kill_radius * lastScale) * progress;
      } else {
        pullRadius *= progress;
        killRadius *= progress;
      }

      const wx = bh.x * gridSize;
      const wy = -bh.y * gridSize;

      if ((wx - camX) ** 2 + (wy - camY) ** 2 <= (fogRadiusWorld * 1.2) ** 2) {
        visibleBlackHoles.push({ wx, wy, pullRadius, killRadius });
      }
    }
  }

  return _buildBlackHoleBuffers(visibleBlackHoles, gridSize);
}

const reusableBhMap = new Map<string, any>();

function _buildLastBhMap(lastState: GameState | null): Map<string, any> {
  reusableBhMap.clear();
  if (lastState && lastState.black_holes) {
    for (const bh of lastState.black_holes) {
      reusableBhMap.set(bh.id, bh);
    }
  }
  return reusableBhMap;
}

function _buildBlackHoleBuffers(
  visibleBlackHoles: { wx: number; wy: number; pullRadius: number; killRadius: number }[],
  gridSize: number
): BlackHoleBuffers {
  const blackHoleCount = visibleBlackHoles.length;
  const blackHoleCoreMatrices = new Float32Array(blackHoleCount * 16);
  const blackHoleRingMatrices = new Float32Array(blackHoleCount * 16);
  const blackHoleGravityMatrices = new Float32Array(blackHoleCount * 16);

  for (let i = 0; i < blackHoleCount; i++) {
    const bh = visibleBlackHoles[i];
    writeMatrix(blackHoleGravityMatrices, i, bh.wx, bh.wy, 0.1, bh.pullRadius * gridSize);
    writeMatrix(blackHoleRingMatrices, i, bh.wx, bh.wy, 0.4, bh.killRadius * gridSize * 1.5);
    writeMatrix(blackHoleCoreMatrices, i, bh.wx, bh.wy, 0.42, bh.killRadius * gridSize);
  }

  return {
    blackHoleCoreMatrices,
    blackHoleRingMatrices,
    blackHoleGravityMatrices,
    blackHoleCount
  };
}
