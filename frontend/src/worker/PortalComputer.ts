// ROLE: Матрицы инстансов порталов.

import type { GameState } from "../types/game";
import { writeMatrix } from "./shared/MathUtils";
import { parseColor } from "./shared/ColorUtils";

export interface PortalBuffers {
  portalDiskMatrices: Float32Array;
  portalDiskColors: Float32Array;
  portalRingMatrices: Float32Array;
  portalRingColors: Float32Array;
  portalCount: number;
}

export function computePortals(
  state: GameState,
  lastState: GameState | null,
  progress: number,
  camX: number,
  camY: number,
  fogRadiusWorld: number,
  gridSize: number,
  calcFogAmount: (wx: number, wy: number) => number,
  fogR: number,
  fogG: number,
  fogB: number
): PortalBuffers {
  const portals = state.portals || [];
  const lastPortalMap = _buildLastPortalMap(lastState);
  const visiblePortals: { wx: number; wy: number; r: number; color: number }[] = [];

  const mapW = state.server_world?.width ?? 100;
  const mapH = state.server_world?.height ?? 100;
  const worldW = mapW * gridSize;
  const worldH = mapH * gridSize;

  if (state.server_world?.portals_enabled !== 0) {
    for (const p of portals) {
      const scale = _interpolatePortalScale(p, lastPortalMap, progress);
      if (scale <= 0.01) continue;

      const radius = p.radius * scale * gridSize;
      const color = parseColor(p.color || '#38bdf8');

      let wx1 = p.x1 * gridSize;
      let wy1 = -p.y1 * gridSize;

      let dx1 = wx1 - camX;
      if (dx1 > worldW / 2) dx1 -= worldW;
      else if (dx1 < -worldW / 2) dx1 += worldW;
      wx1 = camX + dx1;

      let dy1 = wy1 - camY;
      if (dy1 > worldH / 2) dy1 -= worldH;
      else if (dy1 < -worldH / 2) dy1 += worldH;
      wy1 = camY + dy1;

      if ((wx1 - camX) ** 2 + (wy1 - camY) ** 2 <= (fogRadiusWorld * 1.2) ** 2) {
        visiblePortals.push({ wx: wx1, wy: wy1, r: radius, color });
      }

      let wx2 = p.x2 * gridSize;
      let wy2 = -p.y2 * gridSize;

      let dx2 = wx2 - camX;
      if (dx2 > worldW / 2) dx2 -= worldW;
      else if (dx2 < -worldW / 2) dx2 += worldW;
      wx2 = camX + dx2;

      let dy2 = wy2 - camY;
      if (dy2 > worldH / 2) dy2 -= worldH;
      else if (dy2 < -worldH / 2) dy2 += worldH;
      wy2 = camY + dy2;

      if ((wx2 - camX) ** 2 + (wy2 - camY) ** 2 <= (fogRadiusWorld * 1.2) ** 2) {
        visiblePortals.push({ wx: wx2, wy: wy2, r: radius, color });
      }
    }
  }

  return _buildPortalBuffers(visiblePortals, calcFogAmount, fogR, fogG, fogB);
}

const reusablePortalMap = new Map<number, any>();

function _buildLastPortalMap(lastState: GameState | null): Map<number, any> {
  reusablePortalMap.clear();
  if (lastState && lastState.portals) {
    for (const p of lastState.portals) {
      reusablePortalMap.set(p.id, p);
    }
  }
  return reusablePortalMap;
}

function _interpolatePortalScale(p: any, lastPortalMap: Map<number, any>, progress: number): number {
  const lp = lastPortalMap.get(p.id);
  const currentScale = p.current_scale ?? 1.0;
  if (!lp) return currentScale * progress;

  const prevScale = lp.current_scale ?? 1.0;
  return prevScale + (currentScale - prevScale) * progress;
}

function _buildPortalBuffers(
  visiblePortals: { wx: number; wy: number; r: number; color: number }[],
  calcFogAmount: (wx: number, wy: number) => number,
  fogR: number,
  fogG: number,
  fogB: number
): PortalBuffers {
  const portalCount = visiblePortals.length;
  const portalDiskMatrices = new Float32Array(portalCount * 16);
  const portalDiskColors = new Float32Array(portalCount * 3);
  const portalRingMatrices = new Float32Array(portalCount * 16);
  const portalRingColors = new Float32Array(portalCount * 3);

  for (let i = 0; i < portalCount; i++) {
    const p = visiblePortals[i];
    writeMatrix(portalDiskMatrices, i, p.wx, p.wy, 0.3, p.r);
    writeMatrix(portalRingMatrices, i, p.wx, p.wy, 0.32, p.r);

    const pr = ((p.color >> 16) & 255) / 255;
    const pg = ((p.color >> 8) & 255) / 255;
    const pb = (p.color & 255) / 255;

    const fogAmt = calcFogAmount(p.wx, p.wy);
    const finalR = pr + (fogR - pr) * fogAmt;
    const finalG = pg + (fogG - pg) * fogAmt;
    const finalB = pb + (fogB - pb) * fogAmt;

    const cIdx = i * 3;
    portalDiskColors[cIdx + 0] = finalR;
    portalDiskColors[cIdx + 1] = finalG;
    portalDiskColors[cIdx + 2] = finalB;

    portalRingColors[cIdx + 0] = finalR;
    portalRingColors[cIdx + 1] = finalG;
    portalRingColors[cIdx + 2] = finalB;
  }

  return {
    portalDiskMatrices,
    portalDiskColors,
    portalRingMatrices,
    portalRingColors,
    portalCount
  };
}
