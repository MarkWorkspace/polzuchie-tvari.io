// ROLE: Матрицы и цвета инстансов еды.

import type { GameState, Food } from "../types/game";
import { parseColor } from "./shared/ColorUtils";

const FRUIT_IMAGE_MAP: Record<string, number> = {
  "cherry.svg": 1, "strawberry.svg": 2, "grape.svg": 3,
  "mandarin.svg": 4, "persimmon.svg": 5, "apple.svg": 6,
  "pear.svg": 7, "peach.svg": 8, "pineapple.svg": 9,
  "melon.svg": 10, "watermelon.svg": 11,
};

export function computeFood(
  state: GameState,
  lastState: GameState | null,
  progress: number,
  myPlayer: any,
  camX: number,
  camY: number,
  fogRadiusWorld: number,
  dt: number,
  gridSize: number,
  tempFoodMatrices: Float32Array,
  tempFoodColors: Float32Array,
  tempFoodImageIndices: Int32Array
): number {
  const foods = state.foods || [];
  const mapW = state.server_world?.width ?? 100;
  const mapH = state.server_world?.height ?? 100;
  const lastFoodMap = _buildLastFoodMap(lastState);

  const baseRadius = state.server_food?.base_radius ?? 0.2;
  const radiusValueScale = state.server_food?.radius_value_scale ?? 0.1;

  let visibleCount = 0;
  const maxFoodsLimit = Math.min(foods.length, 5000);

  for (let i = 0; i < maxFoodsLimit; i++) {
    const food = foods[i];
    const interpolatedPos = _interpolateFoodPosition(food, lastFoodMap, progress, mapW, mapH);
    let wx = interpolatedPos.x * gridSize + gridSize / 2;
    let wy = -(interpolatedPos.y * gridSize + gridSize / 2);

    // Wrap wx and wy relative to camera position to handle boundary rendering
    const worldW = mapW * gridSize;
    const worldH = mapH * gridSize;

    let dx = wx - camX;
    if (dx > worldW / 2) dx -= worldW;
    else if (dx < -worldW / 2) dx += worldW;
    wx = camX + dx;

    let dy = wy - camY;
    if (dy > worldH / 2) dy -= worldH;
    else if (dy < -worldH / 2) dy += worldH;
    wy = camY + dy;

    const distToCamSq = (wx - camX) ** 2 + (wy - camY) ** 2;
    if (distToCamSq > (fogRadiusWorld * 1.05) ** 2) {
      continue;
    }

    const foodRadius = (baseRadius + Math.sqrt(food.value) * radiusValueScale) * gridSize;
    const dist = Math.sqrt(distToCamSq);

    const attractionResult = _applyAttractionAndGravity(
      state, myPlayer, foodRadius, wx, wy, dist, camX, camY, dt, gridSize, mapW, mapH
    );
    if (attractionResult === null) {
      continue;
    }

    const colorHex = parseColor(food.color);
    const imgIdx = food.image ? (FRUIT_IMAGE_MAP[food.image] ?? 0) : 0;
    const theta = Math.sin(food.id) * Math.PI * 2;
    _writeFoodInstance(
      visibleCount, attractionResult.x, attractionResult.y, foodRadius, theta, colorHex,
      imgIdx, tempFoodMatrices, tempFoodColors, tempFoodImageIndices
    );
    visibleCount++;
  }

  return visibleCount;
}

const lastStateFoodCache = new WeakMap<GameState, Map<number, Food>>();

function _buildLastFoodMap(lastState: GameState | null): Map<number, Food> {
  if (!lastState || !lastState.foods) return new Map();
  
  let map = lastStateFoodCache.get(lastState);
  if (map) return map;

  map = new Map<number, Food>();
  for (let i = 0; i < lastState.foods.length; i++) {
    const lf = lastState.foods[i];
    map.set(lf.id, lf);
  }
  
  lastStateFoodCache.set(lastState, map);
  return map;
}

function _interpolateFoodPosition(food: Food, lastFoodMap: Map<number, Food>, progress: number, mapW: number, mapH: number): { x: number; y: number } {
  const lf = lastFoodMap.get(food.id);
  if (!lf) return { x: food.x, y: food.y };

  const dx = food.x - lf.x;
  const dy = food.y - lf.y;
  
  const x = Math.abs(dx) > mapW / 2 ? food.x : lf.x + dx * progress;
  const y = Math.abs(dy) > mapH / 2 ? food.y : lf.y + dy * progress;
  return { x, y };
}

function _applyAttractionAndGravity(
  state: GameState,
  myPlayer: any,
  foodRadius: number,
  wx: number,
  wy: number,
  dist: number,
  camX: number,
  camY: number,
  dt: number,
  gridSize: number,
  mapW: number,
  mapH: number
): { x: number; y: number } | null {
  if (myPlayer) {
    const baseHeadRadius = state.server_snake?.base_head_radius ?? 0.2;
    const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? 0.0005;
    const startLength = state.server_snake?.start_length ?? 5;
    const myLength = myPlayer.body ? myPlayer.body.length : startLength;
    const myGained = Math.max(0, myLength - startLength);
    const myHeadRadius = (baseHeadRadius + myGained * 10.0 * scoreThicknessScale) * gridSize;

    if (dist < (myHeadRadius + foodRadius)) {
      return null;
    }

    const attractionRadius = (state.server_food?.attraction_radius ?? 3.0) * gridSize;
    if (dist < attractionRadius) {
      const attractionSpeed = (state.server_food?.attraction_speed ?? 8.0) * gridSize;
      const pullDist = attractionSpeed * dt;
      if (dist > 0.1) {
        const ratio = Math.min(1.0, pullDist / dist);
        wx -= (wx - camX) * ratio;
        wy -= (wy - camY) * ratio;
      }
    }
  }

  return _applyBHGravityOnFood(state, wx, wy, dt, gridSize, mapW, mapH);
}

function _applyBHGravityOnFood(
  state: GameState,
  wx: number,
  wy: number,
  dt: number,
  gridSize: number,
  mapW: number,
  mapH: number
): { x: number; y: number } | null {
  if (state.server_world?.black_holes_enabled === 0 || !state.black_holes) {
    return { x: wx, y: wy };
  }

  for (let i = 0; i < state.black_holes.length; i++) {
    const bh = state.black_holes[i];
    if (!bh || bh.state === "dead" || (bh.current_scale ?? 1.0) <= 0.01) continue;

    const bhWx = bh.x * gridSize + gridSize / 2;
    const bhWy = -(bh.y * gridSize + gridSize / 2);
    
    let bhDx = bhWx - wx;
    let bhDy = bhWy - wy;
    const worldW = mapW * gridSize;
    const worldH = mapH * gridSize;

    if (bhDx > worldW / 2) bhDx -= worldW;
    else if (bhDx < -worldW / 2) bhDx += worldW;
    if (bhDy > worldH / 2) bhDy -= worldH;
    else if (bhDy < -worldH / 2) bhDy += worldH;

    const bhDist = Math.sqrt(bhDx * bhDx + bhDy * bhDy);
    const effKillRadius = bh.kill_radius * (bh.current_scale ?? 1.0) * gridSize;
    const effPullRadius = bh.pull_radius * (bh.current_scale ?? 1.0) * gridSize;

    if (bhDist < effKillRadius) {
      return null;
    } else if (bhDist < effPullRadius && bhDist > 0.001) {
      const pullDistFactor = (effPullRadius - bhDist) / effPullRadius;
      const pullForce = state.server_world?.black_holes_pull_force ?? 6.0;
      const pullMag = pullForce * (bh.current_scale ?? 1.0) * pullDistFactor * dt * gridSize * 12.0;
      wx += (bhDx / bhDist) * pullMag;
      wy += (bhDy / bhDist) * pullMag;
    }
  }

  return { x: wx, y: wy };
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
  imageIndices: Int32Array
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
  matrices[mIdx + 14] = 0.65;
  matrices[mIdx + 15] = 1;

  const cIdx = index * 3;
  colors[cIdx + 0] = ((colorHex >> 16) & 255) / 255;
  colors[cIdx + 1] = ((colorHex >> 8) & 255) / 255;
  colors[cIdx + 2] = (colorHex & 255) / 255;
  imageIndices[index] = imageIndex;
}
