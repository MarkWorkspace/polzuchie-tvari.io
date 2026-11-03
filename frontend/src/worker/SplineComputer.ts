// ROLE: Расчет 3D-сплайнов змеек на переиспользуемых scratch-буферах.

import type { Player } from "../types/game";
import { toroidalLerp, wrapDelta } from "./shared/MathUtils";
import { gridToWorldX, gridToWorldY } from "./shared/WorldMath";

export interface SplineSubPath {
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array;
  ny: Float32Array;
  uvY: Float32Array;
  pointsCount: number;
}

// Intermediate arrays are reused between frames. They are valid only inside a
// single computeSplinePaths call; returned subpaths own independent buffers.
const scratchSegX: number[] = [];
const scratchSegY: number[] = [];
const scratchUnwrappedX: number[] = [];
const scratchUnwrappedY: number[] = [];
const scratchSubPathStarts: number[] = [];
const scratchSubPathLengths: number[] = [];

export function computeSplinePaths(
  p: Player,
  oldP: Player | null,
  progress: number,
  mapW: number,
  mapH: number,
  myVisualOffsetX: number,
  myVisualOffsetY: number,
  isSelf: boolean,
  gridSize: number,
): SplineSubPath[] {
  scratchSegX.length = 0;
  scratchSegY.length = 0;
  _interpolateSegments(
    p,
    oldP,
    progress,
    mapW,
    mapH,
    myVisualOffsetX,
    myVisualOffsetY,
    isSelf,
    scratchSegX,
    scratchSegY,
  );

  if (scratchSegX.length === 0) return [];

  const subPathCount = _splitSubPaths(scratchSegX, scratchSegY, mapW, mapH);
  const density = p.body.length > 40 ? 1 : 2;
  const result: SplineSubPath[] = [];

  for (let s = 0; s < subPathCount; s++) {
    const len = scratchSubPathLengths[s];
    if (len < 2) continue;
    const smooth = _generateSmoothSpline(
      scratchUnwrappedX,
      scratchUnwrappedY,
      scratchSubPathStarts[s],
      len,
      density,
      gridSize,
    );
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
  outY: number[],
) {
  const count = Math.floor(p.body.length / 2);
  const oldBody = oldP?.body && oldP.body.length > 0 ? oldP.body : null;
  const oldLen = oldBody ? Math.floor(oldBody.length / 2) : 0;

  outX.length = count;
  outY.length = count;

  for (let i = 0; i < count; i++) {
    const bx = p.body[2 * i];
    const by = p.body[2 * i + 1];

    let x = bx;
    let y = by;

    if (oldBody && oldLen > 0) {
      const oldIdx = i < oldLen ? i : oldLen - 1;
      const ox = oldBody[2 * oldIdx];
      const oy = oldBody[2 * oldIdx + 1];
      const dx = bx - ox;
      const dy = by - oy;
      if (!(dx * dx + dy * dy > 36.0)) {
        x = toroidalLerp(ox, bx, progress, mapW);
        y = toroidalLerp(oy, by, progress, mapH);
      }
    }

    if (isSelf) {
      x += visualX;
      y += visualY;
      if (x < 0) x += mapW;
      else if (x >= mapW) x -= mapW;
      if (y < 0) y += mapH;
      else if (y >= mapH) y -= mapH;
    }
    outX[i] = x;
    outY[i] = y;
  }
}

function _splitSubPaths(segX: number[], segY: number[], mapW: number, mapH: number): number {
  scratchUnwrappedX.length = 0;
  scratchUnwrappedY.length = 0;
  scratchSubPathStarts.length = 0;
  scratchSubPathLengths.length = 0;

  scratchUnwrappedX.push(segX[0]);
  scratchUnwrappedY.push(segY[0]);
  scratchSubPathStarts.push(0);
  scratchSubPathLengths.push(1);
  let subCount = 0;

  for (let i = 1; i < segX.length; i++) {
    const prevX = scratchUnwrappedX[scratchUnwrappedX.length - 1];
    const prevY = scratchUnwrappedY[scratchUnwrappedY.length - 1];

    // Calculate shortest path to the next point
    const adjDx = wrapDelta(segX[i] - segX[i - 1], mapW);
    const adjDy = wrapDelta(segY[i] - segY[i - 1], mapH);
    const adjDistSq = adjDx * adjDx + adjDy * adjDy;

    if (adjDistSq > 36.0) {
      // Portal jump! We MUST split the subpath.
      subCount++;
      scratchSubPathStarts.push(scratchUnwrappedX.length);
      scratchSubPathLengths.push(1);
      scratchUnwrappedX.push(segX[i]);
      scratchUnwrappedY.push(segY[i]);
    } else {
      // Normal movement or Map Border Crossing.
      // We UNWRAP the coordinate by adding the delta to our continuous sequence.
      scratchUnwrappedX.push(prevX + adjDx);
      scratchUnwrappedY.push(prevY + adjDy);
      scratchSubPathLengths[subCount]++;
    }
  }

  return subCount + 1;
}

function _generateSmoothSpline(
  segX: number[],
  segY: number[],
  start: number,
  len: number,
  density: number,
  gridSize: number,
): SplineSubPath {
  // Each source segment contributes one endpoint plus one midpoint when the
  // density is 2. Allocating the exact count avoids the previous maxPoints
  // buffers followed by .slice() copies.
  const pointsCount = 1 + (len - 1) * (density > 1 ? 2 : 1);
  const smoothX = new Float32Array(pointsCount);
  const smoothY = new Float32Array(pointsCount);
  const uvY = new Float32Array(pointsCount);

  let prevWx = gridToWorldX(segX[start], gridSize);
  let prevWy = gridToWorldY(segY[start], gridSize);
  smoothX[0] = prevWx;
  smoothY[0] = prevWy;
  uvY[0] = 0.0;
  let sCount = 1;

  let accumulatedDist = 0.0;
  for (let i = 1; i < len; i++) {
    const currIdx = start + i;
    const currWx = gridToWorldX(segX[currIdx], gridSize);
    const currWy = gridToWorldY(segY[currIdx], gridSize);

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

    prevWx = currWx;
    prevWy = currWy;
  }

  return {
    x: smoothX,
    y: smoothY,
    nx: new Float32Array(pointsCount),
    ny: new Float32Array(pointsCount),
    uvY,
    pointsCount,
  };
}

function _computeNormals(
  x: Float32Array,
  y: Float32Array,
  nx: Float32Array,
  ny: Float32Array,
  count: number,
) {
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
