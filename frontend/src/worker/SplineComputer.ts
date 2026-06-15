// ROLE: Расчет 3D-сплайнов змеек.

import type { Player } from "../types/game";
import { toroidalLerp } from "./shared/MathUtils";

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

function _interpolateSegments(
  p: Player,
  oldP: Player | null,
  progress: number,
  mapW: number,
  mapH: number,
  visualX: number,
  visualY: number,
  isSelf: boolean,
  outX: number[],
  outY: number[]
) {
  const count = p.body.length;
  const useInterpolation = oldP && oldP.body && oldP.body.length > 0;

  for (let i = 0; i < count; i++) {
    const ptB = p.body[i];
    let bx = ptB.x;
    let by = ptB.y;

    if (useInterpolation) {
      const ptA = oldP!.body[i] || oldP!.body[oldP!.body.length - 1];
      const dx = bx - ptA.x;
      const dy = by - ptA.y;
      if (dx * dx + dy * dy <= 36.0) {
        bx = toroidalLerp(ptA.x, ptB.x, progress, mapW);
        by = toroidalLerp(ptA.y, ptB.y, progress, mapH);
      }
    }

    if (isSelf) {
      bx += visualX;
      by += visualY;
      if (bx < 0) bx += mapW; else if (bx >= mapW) bx -= mapW;
      if (by < 0) by += mapH; else if (by >= mapH) by -= mapH;
    }

    outX.push(bx);
    outY.push(by);
  }
}

function _splitSubPaths(segX: number[], segY: number[], mapW: number, mapH: number): { start: number; len: number }[] {
  // We don't use object-based return, because we modify the flat array directly!
  // Actually, instead of modifying the array directly (which we can't if we don't return it),
  // we can just return { start, len } and let _generateSmoothSpline handle ghost points!
  // Wait! The easiest way is to add the ghost points to segX and segY directly and return new splits!
  const newSegX: number[] = [segX[0]];
  const newSegY: number[] = [segY[0]];
  const subPaths: { start: number; len: number }[] = [{ start: 0, len: 1 }];
  let subCount = 0;

  for (let i = 1; i < segX.length; i++) {
    const dx = segX[i] - segX[i - 1];
    const dy = segY[i] - segY[i - 1];
    const segDistSq = dx * dx + dy * dy;

    if (segDistSq > 36.0 || Math.abs(dx) > mapW / 2 || Math.abs(dy) > mapH / 2) {
      let gx_prev = segX[i];
      let gy_prev = segY[i];
      if (dx > mapW / 2) gx_prev -= mapW;
      else if (dx < -mapW / 2) gx_prev += mapW;
      if (dy > mapH / 2) gy_prev -= mapH;
      else if (dy < -mapH / 2) gy_prev += mapH;

      newSegX.push(gx_prev);
      newSegY.push(gy_prev);
      subPaths[subCount].len++;

      subCount++;
      let gx_next = segX[i - 1];
      let gy_next = segY[i - 1];
      if (-dx > mapW / 2) gx_next -= mapW;
      else if (-dx < -mapW / 2) gx_next += mapW;
      if (-dy > mapH / 2) gy_next -= mapH;
      else if (-dy < -mapH / 2) gy_next += mapH;

      subPaths.push({ start: newSegX.length, len: 2 });
      newSegX.push(gx_next, segX[i]);
      newSegY.push(gy_next, segY[i]);
    } else {
      newSegX.push(segX[i]);
      newSegY.push(segY[i]);
      subPaths[subCount].len++;
    }
  }

  // Update original arrays
  segX.length = 0;
  segY.length = 0;
  segX.push(...newSegX);
  segY.push(...newSegY);

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
