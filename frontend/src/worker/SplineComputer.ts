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
  ptB: { x: number; y: number },
  oldPt: { x: number; y: number } | undefined,
  useInterpolation: boolean,
  progress: number,
  mapW: number,
  mapH: number
): { x: number; y: number } {
  if (!useInterpolation || !oldPt) return { x: ptB.x, y: ptB.y };
  const dx = ptB.x - oldPt.x, dy = ptB.y - oldPt.y;
  if (dx * dx + dy * dy > 36.0) return { x: ptB.x, y: ptB.y };
  return {
    x: toroidalLerp(oldPt.x, ptB.x, progress, mapW),
    y: toroidalLerp(oldPt.y, ptB.y, progress, mapH)
  };
}

function _interpolateSegments(
  p: Player, oldP: Player | null, progress: number,
  mapW: number, mapH: number, visualX: number, visualY: number,
  isSelf: boolean, outX: number[], outY: number[]
) {
  const count = p.body.length;
  const useInterp = !!(oldP && oldP.body && oldP.body.length > 0);

  for (let i = 0; i < count; i++) {
    const ptB = p.body[i];
    const oldPt = oldP ? (oldP.body[i] || oldP.body[oldP.body.length - 1]) : undefined;
    let { x, y } = _getInterpolatedSegment(ptB, oldPt, useInterp, progress, mapW, mapH);

    if (isSelf) {
      x += visualX; y += visualY;
      if (x < 0) x += mapW; else if (x >= mapW) x -= mapW;
      if (y < 0) y += mapH; else if (y >= mapH) y -= mapH;
    }
    outX.push(x);
    outY.push(y);
  }
}

function _handleWrapAround(
  dx: number, dy: number, mapW: number, mapH: number,
  prevX: number, prevY: number, currX: number, currY: number,
  newSegX: number[], newSegY: number[], subPaths: { start: number; len: number }[],
  subCount: number
): number {
  let gx_prev = currX, gy_prev = currY;
  if (dx > mapW / 2) gx_prev -= mapW; else if (dx < -mapW / 2) gx_prev += mapW;
  if (dy > mapH / 2) gy_prev -= mapH; else if (dy < -mapH / 2) gy_prev += mapH;

  newSegX.push(gx_prev);
  newSegY.push(gy_prev);
  subPaths[subCount].len++;

  let gx_next = prevX, gy_next = prevY;
  if (-dx > mapW / 2) gx_next -= mapW; else if (-dx < -mapW / 2) gx_next += mapW;
  if (-dy > mapH / 2) gy_next -= mapH; else if (-dy < -mapH / 2) gy_next += mapH;

  subPaths.push({ start: newSegX.length, len: 2 });
  newSegX.push(gx_next, currX);
  newSegY.push(gy_next, currY);
  return subCount + 1;
}

function _splitSubPaths(segX: number[], segY: number[], mapW: number, mapH: number): { start: number; len: number }[] {
  const newSegX = [segX[0]], newSegY = [segY[0]];
  const subPaths = [{ start: 0, len: 1 }];
  let subCount = 0;

  for (let i = 1; i < segX.length; i++) {
    const dx = segX[i] - segX[i - 1], dy = segY[i] - segY[i - 1];
    const [adjDx, adjDy] = toroidalDelta(segX[i - 1], segY[i - 1], segX[i], segY[i], mapW, mapH);
    const adjDistSq = adjDx * adjDx + adjDy * adjDy;

    if (adjDistSq > 36.0) {
      subCount++;
      subPaths.push({ start: newSegX.length, len: 1 });
      newSegX.push(segX[i]);
      newSegY.push(segY[i]);
    } else if (dx * dx + dy * dy > 36.0) {
      subCount = _handleWrapAround(dx, dy, mapW, mapH, segX[i - 1], segY[i - 1], segX[i], segY[i], newSegX, newSegY, subPaths, subCount);
    } else {
      newSegX.push(segX[i]);
      newSegY.push(segY[i]);
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
