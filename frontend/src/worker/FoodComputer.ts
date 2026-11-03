// ROLE: Матрицы и цвета инстансов еды на переиспользуемых буферах и last-food кэше.

import type { BlackHole, Food, GameState } from "../types/game";
import { parseColor } from "./shared/ColorUtils";
import { wrapDelta } from "./shared/MathUtils";
import { computeHeadRadiusWorld } from "./shared/PlayerMetrics";
import { gridToWorldX, gridToWorldY } from "./shared/WorldMath";

const FRUIT_IMAGE_MAP: Record<string, number> = {
  "cherry.svg": 1,
  "strawberry.svg": 2,
  "grape.svg": 3,
  "mandarin.svg": 4,
  "persimmon.svg": 5,
  "apple.svg": 6,
  "pear.svg": 7,
  "peach.svg": 8,
  "pineapple.svg": 9,
  "melon.svg": 10,
  "watermelon.svg": 11,
};

interface MutablePoint {
  x: number;
  y: number;
}

const scratchPoint: MutablePoint = { x: 0, y: 0 };

// Rebuild the id -> food lookup only when the last state reference changes.
// The map is reused across frames so a new tick does not allocate 5000 entries.
// WeakRef avoids retaining the previous GameState strongly after a session ends.
let cachedLastStateRef: WeakRef<GameState> | null = null;
const cachedLastFoodMap = new Map<number, Food>();

export function computeFood(
  state: GameState,
  lastState: GameState | null,
  progress: number,
  myPlayer: any,
  myHeadX: number,
  myHeadY: number,
  camX: number,
  camY: number,
  fogRadiusWorld: number,
  dt: number,
  gridSize: number,
  showAllInMainCopy: boolean,
  tempFoodMatrices: Float32Array,
  tempFoodColors: Float32Array,
  tempFoodImageIndices: Int32Array,
): number {
  const foods = state.foods || [];
  const mapW = state.server_world?.width ?? 100;
  const mapH = state.server_world?.height ?? 100;
  const lastFoodMap = _buildLastFoodMap(lastState);

  const baseRadius = state.server_food?.base_radius ?? 0.2;
  const radiusValueScale = state.server_food?.radius_value_scale ?? 0.1;

  const worldW = mapW * gridSize;
  const worldH = mapH * gridSize;
  const fogRadiusSq = (fogRadiusWorld * 1.05) ** 2;

  const myHeadRadius = myPlayer ? computeHeadRadiusWorld(state, myPlayer.body, gridSize) : 0;
  const attractionRadius = (state.server_food?.attraction_radius ?? 3.0) * gridSize;
  const attractionSpeed = (state.server_food?.attraction_speed ?? 8.0) * gridSize;
  const attractionPullDist = attractionSpeed * dt;

  const blackHoles = state.black_holes;
  const hasBlackHoles =
    state.server_world?.black_holes_enabled !== 0 && !!blackHoles && blackHoles.length > 0;
  const blackHolesPullForce = state.server_world?.black_holes_pull_force ?? 6.0;

  let visibleCount = 0;
  const maxFoodsLimit = Math.min(foods.length, 5000);

  for (let i = 0; i < maxFoodsLimit; i++) {
    const food = foods[i];

    // Interpolate the grid position in local numbers instead of returning a
    // fresh {x, y} object for every food item.
    let gridX = food.x;
    let gridY = food.y;
    const lf = lastFoodMap.get(food.id);
    if (lf) {
      const dx = food.x - lf.x;
      const dy = food.y - lf.y;
      gridX = Math.abs(dx) > mapW / 2 ? food.x : lf.x + dx * progress;
      gridY = Math.abs(dy) > mapH / 2 ? food.y : lf.y + dy * progress;
    }

    let wx = gridToWorldX(gridX, gridSize);
    let wy = gridToWorldY(gridY, gridSize);

    // Wrap wx and wy relative to camera position to handle boundary rendering
    if (!showAllInMainCopy) {
      wx = camX + wrapDelta(wx - camX, worldW);
      wy = camY + wrapDelta(wy - camY, worldH);
    }

    const distToCamSq = (wx - camX) ** 2 + (wy - camY) ** 2;
    if (!showAllInMainCopy && distToCamSq > fogRadiusSq) {
      continue;
    }

    const foodRadius = (baseRadius + Math.sqrt(food.value) * radiusValueScale) * gridSize;
    const dist = Math.sqrt(distToCamSq);

    scratchPoint.x = wx;
    scratchPoint.y = wy;

    if (
      myPlayer &&
      !_applyAttraction(
        scratchPoint,
        myHeadX,
        myHeadY,
        myHeadRadius,
        attractionRadius,
        attractionPullDist,
        foodRadius,
        dist,
      )
    ) {
      continue;
    }

    // Fast path: when black holes are disabled or absent, skip the per-food
    // gravity pass entirely.
    if (hasBlackHoles && blackHoles) {
      if (
        !_applyBHGravityOnFood(
          blackHoles,
          scratchPoint,
          dt,
          gridSize,
          worldW,
          worldH,
          blackHolesPullForce,
        )
      ) {
        continue;
      }
    }

    const colorHex = parseColor(food.color);
    const imgIdx = food.image ? (FRUIT_IMAGE_MAP[food.image] ?? 0) : 0;
    const theta = Math.sin(food.id) * Math.PI * 2;
    _writeFoodInstance(
      visibleCount,
      scratchPoint.x,
      scratchPoint.y,
      foodRadius,
      theta,
      colorHex,
      imgIdx,
      tempFoodMatrices,
      tempFoodColors,
      tempFoodImageIndices,
    );
    visibleCount++;
  }

  return visibleCount;
}

function _buildLastFoodMap(lastState: GameState | null): Map<number, Food> {
  if (!lastState?.foods) {
    cachedLastFoodMap.clear();
    cachedLastStateRef = null;
    return cachedLastFoodMap;
  }

  if (cachedLastStateRef?.deref() === lastState) {
    return cachedLastFoodMap;
  }

  // Drop the ref before filling the map: if a getter throws mid-build, the next
  // call cannot mistake the partially filled map for a valid cache.
  cachedLastStateRef = null;
  cachedLastFoodMap.clear();
  const foods = lastState.foods;
  for (let i = 0; i < foods.length; i++) {
    const lf = foods[i];
    cachedLastFoodMap.set(lf.id, lf);
  }
  cachedLastStateRef = new WeakRef(lastState);
  return cachedLastFoodMap;
}

function _applyAttraction(
  point: MutablePoint,
  myHeadX: number,
  myHeadY: number,
  myHeadRadius: number,
  attractionRadius: number,
  attractionPullDist: number,
  foodRadius: number,
  dist: number,
): boolean {
  if (dist < myHeadRadius + foodRadius) {
    return false;
  }

  const dx = point.x - myHeadX;
  const dy = point.y - myHeadY;
  const distToHead = Math.sqrt(dx * dx + dy * dy);
  if (distToHead < attractionRadius && distToHead > 0.1) {
    const ratio = Math.min(1.0, attractionPullDist / distToHead);
    point.x -= (point.x - myHeadX) * ratio;
    point.y -= (point.y - myHeadY) * ratio;
  }

  return true;
}

function _applyBHGravityOnFood(
  blackHoles: BlackHole[],
  point: MutablePoint,
  dt: number,
  gridSize: number,
  worldW: number,
  worldH: number,
  pullForce: number,
): boolean {
  for (let i = 0; i < blackHoles.length; i++) {
    const bh = blackHoles[i];
    if (!bh || bh.state === "dead" || (bh.current_scale ?? 1.0) <= 0.01) continue;

    const scale = bh.current_scale ?? 1.0;
    const bhWx = gridToWorldX(bh.x, gridSize);
    const bhWy = gridToWorldY(bh.y, gridSize);

    const bhDx = wrapDelta(bhWx - point.x, worldW);
    const bhDy = wrapDelta(bhWy - point.y, worldH);

    const bhDist = Math.sqrt(bhDx * bhDx + bhDy * bhDy);
    const effKillRadius = bh.kill_radius * scale * gridSize;
    const effPullRadius = bh.pull_radius * scale * gridSize;

    if (bhDist < effKillRadius) {
      return false;
    } else if (bhDist < effPullRadius && bhDist > 0.001) {
      const pullDistFactor = (effPullRadius - bhDist) / effPullRadius;
      const pullMag = pullForce * scale * pullDistFactor * dt * gridSize * 12.0;
      point.x += (bhDx / bhDist) * pullMag;
      point.y += (bhDy / bhDist) * pullMag;
    }
  }

  return true;
}

function _writeFoodInstance(
  index: number,
  tx: number,
  ty: number,
  radius: number,
  theta: number,
  colorHex: number,
  imageIndex: number,
  matrices: Float32Array,
  colors: Float32Array,
  imageIndices: Int32Array,
) {
  const mIdx = index * 16;
  matrices.fill(0, mIdx, mIdx + 16);

  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  matrices[mIdx + 0] = radius * cos;
  matrices[mIdx + 1] = radius * sin;
  matrices[mIdx + 4] = -radius * sin;
  matrices[mIdx + 5] = radius * cos;
  matrices[mIdx + 10] = radius;
  matrices[mIdx + 12] = tx;
  matrices[mIdx + 13] = ty;
  matrices[mIdx + 14] = radius;
  matrices[mIdx + 15] = 1;

  const cIdx = index * 3;
  colors[cIdx + 0] = ((colorHex >> 16) & 255) / 255;
  colors[cIdx + 1] = ((colorHex >> 8) & 255) / 255;
  colors[cIdx + 2] = (colorHex & 255) / 255;
  imageIndices[index] = imageIndex;
}
