// ROLE: Сборка vertex/index-буферов из сплайнов.

import type { SplineSubPath } from "./SplineComputer";
import { GrowableFloat32Array, GrowableUint32Array } from "./shared/GrowableArray";
import { parseColor } from "./shared/ColorUtils";

export interface GeometryBuffers {
  vertices: GrowableFloat32Array;
  uvs: GrowableFloat32Array;
  colors: GrowableFloat32Array;
  params: GrowableFloat32Array;
  indices: GrowableUint32Array;
}

export function appendSnakeMesh(
  subPaths: SplineSubPath[],
  skin: string,
  radius: number,
  gridSize: number,
  snakeZ: number,
  bodyBufs: GeometryBuffers
) {
  const skinColor = _resolveSkinColor(skin);
  const totalWidth = radius * gridSize;

  let accumDistance = 0.0;
  for (const path of subPaths) {
    if (path.pointsCount < 2) continue;
    accumDistance += path.uvY[path.pointsCount - 1];
  }

  let subPathIdx = 0;
  for (const path of subPaths) {
    if (path.pointsCount < 2) continue;
    _appendSubPathMesh(
      path, subPathIdx, subPaths.length, skinColor, totalWidth,
      accumDistance, snakeZ, bodyBufs
    );
    subPathIdx++;
  }
}

function _resolveSkinColor(skin: string): { r: number; g: number; b: number } {
  let skinTypeVal = 1.0;
  let skinColHex = '#22c55e';
  
  if (skin === 'zebra') skinTypeVal = 2.0;
  else if (skin === 'tiger') skinTypeVal = 3.0;
  else if (skin === 'cyberpunk') skinTypeVal = 4.0;
  else if (skin === 'rainbow') skinTypeVal = 5.0;
  else {
    skinColHex = skin || '#22c55e';
  }
  
  const skinColorInt = parseColor(skinColHex);
  const skinR = ((skinColorInt >> 16) & 255) / 255;
  const skinG = ((skinColorInt >> 8) & 255) / 255;
  const skinB = (skinColorInt & 255) / 255;

  return {
    r: skinTypeVal > 1.5 ? skinTypeVal : skinR,
    g: skinG,
    b: skinB
  };
}

function _appendSubPathMesh(
  path: SplineSubPath,
  pathIdx: number,
  totalSubPaths: number,
  skinColor: { r: number; g: number; b: number },
  totalWidth: number,
  accumDistance: number,
  snakeZ: number,
  bodyBufs: GeometryBuffers
) {
  const baseVIdx = bodyBufs.vertices.length / 3;
  const count = path.pointsCount;

  const exts = _computeExtensions(path, pathIdx, totalSubPaths, totalWidth, accumDistance);

  for (let i = 0; i < count; i++) {
    const wx = path.x[i];
    const wy = path.y[i];
    const nx = path.nx[i];
    const ny = path.ny[i];
    const uvY = path.uvY[i];

    const zLift = pathIdx === 0 && accumDistance > 0 ? 1.0 - Math.min(1.0, Math.max(0.0, uvY / accumDistance)) : 0.0;
    const bodyZ = snakeZ + zLift * 0.08;

    _writeBodyVertices(wx, wy, bodyZ, nx, ny, uvY, i, count, totalWidth, accumDistance, exts, skinColor, bodyBufs);
  }

  _writeIndices(baseVIdx, count, bodyBufs.indices);
}

function _computeExtensions(
  path: SplineSubPath,
  pathIdx: number,
  totalSubPaths: number,
  totalWidth: number,
  accumDistance: number
) {
  const count = path.pointsCount;
  let headExt = { bx: 0, by: 0, buvY: 0, exists: false };
  let tailExt = { bx: 0, by: 0, buvY: 0, exists: false };

  if (pathIdx === 0) {
    const dx = path.x[0] - path.x[1];
    const dy = path.y[0] - path.y[1];
    const len = Math.hypot(dx, dy) || 0.001;
    headExt = {
      bx: path.x[0] + (dx / len) * totalWidth,
      by: path.y[0] + (dy / len) * totalWidth,
      buvY: -totalWidth,
      exists: true
    };
  }

  if (pathIdx === totalSubPaths - 1) {
    const dx = path.x[count - 1] - path.x[count - 2];
    const dy = path.y[count - 1] - path.y[count - 2];
    const len = Math.hypot(dx, dy) || 0.001;
    tailExt = {
      bx: path.x[count - 1] + (dx / len) * totalWidth,
      by: path.y[count - 1] + (dy / len) * totalWidth,
      buvY: accumDistance + totalWidth,
      exists: true
    };
  }

  return { head: headExt, tail: tailExt };
}

function _writeBodyVertices(
  wx: number,
  wy: number,
  bodyZ: number,
  nx: number,
  ny: number,
  uvY: number,
  index: number,
  count: number,
  totalWidth: number,
  accumDistance: number,
  ext: any,
  color: { r: number; g: number; b: number },
  bufs: GeometryBuffers
) {
  let bwx = wx;
  let bwy = wy;
  let buvY = uvY;

  if (index === 0 && ext.head.exists) {
    bwx = ext.head.bx;
    bwy = ext.head.by;
    buvY = ext.head.buvY;
  } else if (index === count - 1 && ext.tail.exists) {
    bwx = ext.tail.bx;
    bwy = ext.tail.by;
    buvY = ext.tail.buvY;
  }

  const pxLeft = bwx + nx * totalWidth;
  const pyLeft = bwy + ny * totalWidth;
  const pxRight = bwx - nx * totalWidth;
  const pyRight = bwy - ny * totalWidth;

  bufs.vertices.push6(pxLeft, pyLeft, bodyZ, pxRight, pyRight, bodyZ);
  bufs.uvs.push4(0.0, buvY, 1.0, buvY);
  bufs.colors.push6(color.r, color.g, color.b, color.r, color.g, color.b);
  bufs.params.push4(totalWidth, accumDistance, totalWidth, accumDistance);
}

function _writeIndices(
  baseVIdx: number,
  count: number,
  bodyIndices: GrowableUint32Array
) {
  for (let i = 0; i < count - 1; i++) {
    const v0 = baseVIdx + i * 2;
    const v1 = baseVIdx + i * 2 + 1;
    const v2 = baseVIdx + (i + 1) * 2;
    const v3 = baseVIdx + (i + 1) * 2 + 1;

    bodyIndices.push6(v0, v1, v2, v2, v1, v3);
  }
}
