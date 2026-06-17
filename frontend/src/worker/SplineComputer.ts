// ROLE: Расчет 3D-сплайнов змеек.

import type { Player } from "../types/game";
import { toroidalLerp, toroidalDelta } from "./shared/MathUtils";

export interface SplineSubPath {
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  uvY: Float32Array;
  pointsCount: number;
}

export function computeSplinePaths(
  p: Player,
  oldP: Player | null,
  progress: number,
  mapW: number,
  mapH: number,
  myVisualOffsetX: number,
  myVisualOffsetY: number,
  isSelf: boolean,
  gridSize: number
): SplineSubPath[] {
  const segX: number[] = [];
  const segY: number[] = [];
  _interpolateSegments(p, oldP, progress, mapW, mapH, myVisualOffsetX, myVisualOffsetY, isSelf, segX, segY);

  if (segX.length === 0) return [];

  const subPaths = _splitSubPaths(segX, segY, mapW, mapH);
  const density = p.body.length > 40 ? 1 : 2;
  const result: SplineSubPath[] = [];

  for (const sub of subPaths) {
    if (sub.len < 2) continue;
    const smooth = _generateSmoothSpline(segX, segY, sub.start, sub.len, density, gridSize);
    if (smooth.pointsCount < 2) continue;
    
    _computeNormals(smooth.x, smooth.y, smooth.nx, smooth.ny, smooth.pointsCount);
    result.push(smooth);
  }

  return result;
}

function _getInterpolatedSegment(
  bx: number, by: number,
  ox: number | undefined, oy: number | undefined,
  useInterpolation: boolean,
  progress: number,
  mapW: number,
  mapH: number
): { x: number; y: number } {
  if (ox === undefined || oy === undefined) return { x: bx, y: by };
  if (!useInterpolation) return { x: bx, y: by };
  const dx = bx - ox, dy = by - oy;
  if (dx * dx + dy * dy > 36.0) return { x: bx, y: by };
  return {
    x: toroidalLerp(ox, bx, progress, mapW),
    y: toroidalLerp(oy, by, progress, mapH)
  };
}

function _interpolateSegments(
  p: Player, oldP: Player | null, progress: number,
  mapW: number, mapH: number, visualX: number, visualY: number,
  isSelf: boolean, outX: number[], outY: number[]
) {
  const count = Math.floor(p.body.length / 2);
  const useInterp = !!(oldP && oldP.body && oldP.body.length > 0);

  for (let i = 0; i < count; i++) {
    const bx = p.body[2 * i];
    const by = p.body[2 * i + 1];
    
    let ox: number | undefined;
    let oy: number | undefined;
    
    if (useInterp && oldP && oldP.body) {
       const oldLen = Math.floor(oldP.body.length / 2);
       if (oldLen > 0) {
           const oldIdx = i < oldLen ? i : oldLen - 1;
           ox = oldP.body[2 * oldIdx];
           oy = oldP.body[2 * oldIdx + 1];
       }
    }

    let { x, y } = _getInterpolatedSegment(bx, by, ox, oy, useInterp, progress, mapW, mapH);

    if (isSelf) {
      x += visualX; y += visualY;
      if (x < 0) x += mapW; else if (x >= mapW) x -= mapW;
      if (y < 0) y += mapH; else if (y >= mapH) y -= mapH;
    }
    outX.push(x);
    outY.push(y);
  }
}

function _splitSubPaths(segX: number[], segY: number[], mapW: number, mapH: number): { start: number; len: number }[] {
  const newSegX = [segX[0]];
  const newSegY = [segY[0]];
  const subPaths = [{ start: 0, len: 1 }];
  let subCount = 0;

  for (let i = 1; i < segX.length; i++) {
    const prevX = newSegX[newSegX.length - 1];
    const prevY = newSegY[newSegY.length - 1];
    
    // Calculate shortest path to the next point
    const [adjDx, adjDy] = toroidalDelta(segX[i - 1], segY[i - 1], segX[i], segY[i], mapW, mapH);
    const adjDistSq = adjDx * adjDx + adjDy * adjDy;

    if (adjDistSq > 36.0) {
      // Portal jump! We MUST split the subpath.
      subCount++;
      subPaths.push({ start: newSegX.length, len: 1 });
      newSegX.push(segX[i]);
      newSegY.push(segY[i]);
    } else {
      // Normal movement or Map Border Crossing.
      // We UNWRAP the coordinate by adding the delta to our continuous sequence.
      newSegX.push(prevX + adjDx);
      newSegY.push(prevY + adjDy);
      subPaths[subCount].len++;
    }
  }

  segX.length = 0; segY.length = 0;
  segX.push(...newSegX); segY.push(...newSegY);
  return subPaths;
}

function _generateSmoothSpline(
  segX: number[],
  segY: number[],
  start: number,
  len: number,
  density: number,
  gridSize: number
): SplineSubPath {
  const maxPoints = len * (density + 1);
  const smoothX = new Float32Array(maxPoints);
  const smoothY = new Float32Array(maxPoints);
  const uvY = new Float32Array(maxPoints);

  smoothX[0] = segX[start] * gridSize + gridSize / 2;
  smoothY[0] = -(segY[start] * gridSize + gridSize / 2);
  uvY[0] = 0.0;
  let sCount = 1;

  let accumulatedDist = 0.0;
  for (let i = 1; i < len; i++) {
    const prevIdx = start + i - 1;
    const currIdx = start + i;

    const prevWx = segX[prevIdx] * gridSize + gridSize / 2;
    const prevWy = -(segY[prevIdx] * gridSize + gridSize / 2);
    const currWx = segX[currIdx] * gridSize + gridSize / 2;
    const currWy = -(segY[currIdx] * gridSize + gridSize / 2);

    const segDist = Math.hypot(currWx - prevWx, currWy - prevWy);
    accumulatedDist += segDist;

    if (density > 1) {
      smoothX[sCount] = prevWx + (currWx - prevWx) * 0.5;
      smoothY[sCount] = prevWy + (currWy - prevWy) * 0.5;
      uvY[sCount] = accumulatedDist - segDist * 0.5;
      sCount++;
    }

    smoothX[sCount] = currWx;
    smoothY[sCount] = currWy;
    uvY[sCount] = accumulatedDist;
    sCount++;
  }

  return {
    x: smoothX.slice(0, sCount),
    y: smoothY.slice(0, sCount),
    nx: new Float32Array(sCount),
    ny: new Float32Array(sCount),
    uvY: uvY.slice(0, sCount),
    pointsCount: sCount,
  };
}

function _computeNormals(x: Float32Array, y: Float32Array, nx: Float32Array, ny: Float32Array, count: number) {
  for (let i = 0; i < count; i++) {
    let dx = 0;
    let dy = 0;

    if (i === 0) {
      dx = x[1] - x[0];
      dy = y[1] - y[0];
    } else if (i === count - 1) {
      dx = x[count - 1] - x[count - 2];
      dy = y[count - 1] - y[count - 2];
    } else {
      dx = x[i + 1] - x[i - 1];
      dy = y[i + 1] - y[i - 1];
    }

    const len = Math.hypot(dx, dy) || 0.001;
    nx[i] = -dy / len;
    ny[i] = dx / len;
  }
}
