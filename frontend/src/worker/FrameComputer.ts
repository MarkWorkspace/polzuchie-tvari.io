// ROLE: Сборка кадра игры (матрицы, вершины, лидерборд) для отправки на фронтенд.

import type { GameState } from "../types/game";
import { CameraPredictor } from "./CameraPredictor";
import { computeFood } from "./FoodComputer";
import { computePortals } from "./PortalComputer";
import { computeBlackHoles } from "./BlackHoleComputer";
import { type GeometryBuffers } from "./MeshBuilder";
import { EyeComputer } from "./EyeComputer";
import { ParticleComputer } from "./ParticleComputer";
import { parseColor } from "./shared/ColorUtils";
import { processSnakes } from "./SnakeProcessor";
import { GrowableFloat32Array } from "./shared/GrowableArray";

const FOG_R = 12 / 255;
const FOG_G = 12 / 255;
const FOG_B = 15 / 255;

export interface FrameResult {
  payload: any;
  transferables: ArrayBuffer[];
}

function _calcFogRadius(state: GameState, myPlayer: any, startLength: number, isSpectator: boolean): number {
  if (isSpectator || myPlayer?.is_dead) {
    return 1000000.0; // Infinite fog for spectators and dead players
  }
  const myLength = myPlayer && myPlayer.body ? myPlayer.body.length : startLength;
  const minFog = state.server_visual?.min_fog_radius ?? 900.0;
  const fogExpansion = state.server_visual?.fog_score_expansion_coeff ?? 0.5;
  return minFog + (Math.max(0, myLength - startLength) * 10.0) * fogExpansion;
}

function _buildLeaderboard(state: GameState, myId: string): any[] {
  return Object.entries(state.players)
    .filter(([_, p]) => !p.is_dead)
    .map(([pid, p]) => ({
      id: pid,
      nickname: p.nickname || "Игрок",
      score: p.score || 0,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      isMe: pid === myId
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

const foodMinimapBuffer = new GrowableFloat32Array(2000 * 4);

function _buildFoodMinimap(foods: any[]): Float32Array {
  foodMinimapBuffer.reset();
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    if (f.value >= 10.0) {
      foodMinimapBuffer.push4(
        f.x,
        f.y,
        f.value,
        parseColor(f.color || "#ef4444")
      );
    }
  }
  return foodMinimapBuffer.slice();
}

function _buildFrameResult(
  state: GameState,
  cam: any,
  fogRadiusWorld: number,
  foodCount: number,
  portals: any,
  blackHoles: any,
  bodyBufs: GeometryBuffers,
  eyeBufs: any,
  eyeCount: number,
  pupilCount: number,
  partBufs: any,
  tempFoodMatrices: Float32Array,
  tempFoodColors: Float32Array,
  tempFoodImageIndices: Int32Array,
  nicknames: any[],
  activePlayers: any[],
  leaderboard: any[],
  accumulatedKillEvents: any[],
  foodMinimapData: Float32Array
): FrameResult {
  const bVerts = bodyBufs.vertices.slice();
  const bUVs = bodyBufs.uvs.slice();
  const bColors = bodyBufs.colors.slice();
  const bParams = bodyBufs.params.slice();
  const bIndices = bodyBufs.indices.slice();

  const fMatrices = tempFoodMatrices.slice(0, foodCount * 16);
  const fColors = tempFoodColors.slice(0, foodCount * 3);
  const fImageIndices = tempFoodImageIndices.slice(0, foodCount);

  const lightweightPlayers: Record<string, any> = {};
  for (const pid in state.players) {
    const p = state.players[pid];
    lightweightPlayers[pid] = {
      nickname: p.nickname,
      skin: p.skin,
      score: p.score,
      accelerating: p.accelerating,
      body_len: p.body ? Math.floor(p.body.length / 2) : 0,
      head_x: p.body && p.body.length >= 2 ? p.body[0] : 0,
      head_y: p.body && p.body.length >= 2 ? p.body[1] : 0,
      angle: p.angle,
      is_dead: p.is_dead,
      kills: p.kills,
      deaths: p.deaths,
      teleport_state: p.teleport_state
    };
  }

  const payload = {
    type: "FRAME_DATA",
    bodyVertices: bVerts, bodyUVs: bUVs, bodyColors: bColors, bodySnakeParams: bParams, bodyIndices: bIndices,
    eyeMatrices: eyeBufs.eyeMatrices, eyeColors: eyeBufs.eyeColors, eyeCount,
    pupilMatrices: eyeBufs.pupilMatrices, pupilColors: eyeBufs.pupilColors, pupilCount,
    particleMatrices: partBufs.particleMatrices, particleColors: partBufs.particleColors, particleCount: partBufs.particleCount,
    foodMatrices: fMatrices,
    foodColors: fColors,
    foodImageIndices: fImageIndices,
    foodCount,
    portalDiskMatrices: portals.portalDiskMatrices, portalDiskColors: portals.portalDiskColors,
    portalRingMatrices: portals.portalRingMatrices, portalRingColors: portals.portalRingColors, portalCount: portals.portalCount,
    blackHoleCoreMatrices: blackHoles.blackHoleCoreMatrices, blackHoleRingMatrices: blackHoles.blackHoleRingMatrices,
    blackHoleGravityMatrices: blackHoles.blackHoleGravityMatrices, blackHoleCount: blackHoles.blackHoleCount,
    camX: cam.camX, camY: cam.camY, camAngle: cam.camAngle,
    fogRadiusWorld, nicknames, activePlayers, leaderboard,
    kill_events: [...accumulatedKillEvents],
    tombstones: state.tombstones || [],
    foodMinimapData,
    gameState: {
      server_tick_rate: state.server_tick_rate,
      server_world: state.server_world,
      server_simulation: state.server_simulation,
      server_snake: state.server_snake,
      server_visual: state.server_visual,
      server_food: state.server_food,
      server_boost: state.server_boost,
      players: lightweightPlayers,
      foods: [],
      portals: state.portals,
      black_holes: state.black_holes,
      tombstones: state.tombstones
    }
  };

  const transferables: ArrayBuffer[] = [];
  const maybeTransfer = (buf: ArrayBufferLike) => {
    if (typeof SharedArrayBuffer !== "undefined" && buf instanceof SharedArrayBuffer) return;
    transferables.push(buf as ArrayBuffer);
  };

  maybeTransfer(bVerts.buffer); maybeTransfer(bUVs.buffer); maybeTransfer(bColors.buffer); maybeTransfer(bParams.buffer); maybeTransfer(bIndices.buffer);
  maybeTransfer(eyeBufs.eyeMatrices.buffer); maybeTransfer(eyeBufs.eyeColors.buffer);
  maybeTransfer(eyeBufs.pupilMatrices.buffer); maybeTransfer(eyeBufs.pupilColors.buffer);
  maybeTransfer(partBufs.particleMatrices.buffer); maybeTransfer(partBufs.particleColors.buffer);
  maybeTransfer(foodMinimapData.buffer);

  maybeTransfer(fMatrices.buffer);
  maybeTransfer(fColors.buffer);
  maybeTransfer(fImageIndices.buffer);

  maybeTransfer(portals.portalDiskMatrices.buffer);
  maybeTransfer(portals.portalDiskColors.buffer);
  maybeTransfer(portals.portalRingMatrices.buffer);
  maybeTransfer(portals.portalRingColors.buffer);

  maybeTransfer(blackHoles.blackHoleCoreMatrices.buffer);
  maybeTransfer(blackHoles.blackHoleRingMatrices.buffer);
  maybeTransfer(blackHoles.blackHoleGravityMatrices.buffer);

  return { payload, transferables };
}

export function computeFrame(
  dt: number,
  localInput: any,
  gridSize: number,
  state: GameState,
  lastState: GameState | null,
  progress: number,
  myId: string,
  isSpectator: boolean,
  showAllInMainCopy: boolean,
  camera: CameraPredictor,
  particles: ParticleComputer,
  eyes: EyeComputer,
  accumulatedKillEvents: any[],
  bodyBufs: GeometryBuffers,
  tempFoodMatrices: Float32Array,
  tempFoodColors: Float32Array,
  tempFoodImageIndices: Int32Array
): FrameResult {
  const cam = camera.predict(dt, myId, localInput, state, lastState, progress, gridSize);
  const myPlayer = state.players[myId];
  const startLength = state.server_snake?.start_length ?? 5;
  const fogRadiusWorld = _calcFogRadius(state, myPlayer, startLength, isSpectator);

  const calcFog = (wx: number, wy: number) => {
    const dist = Math.sqrt((wx - cam.camX) ** 2 + (wy - cam.camY) ** 2);
    const start = fogRadiusWorld * 0.75;
    const end = fogRadiusWorld * 0.95;
    return dist >= end ? 1.0 : (dist <= start ? 0.0 : (dist - start) / (end - start));
  };

  let myHeadX = cam.camX;
  let myHeadY = cam.camY;
  if (myPlayer && myPlayer.body && myPlayer.body.length >= 2) {
    myHeadX = myPlayer.body[0] * gridSize + gridSize / 2;
    myHeadY = -(myPlayer.body[1] * gridSize + gridSize / 2);
  }

  const foodCount = computeFood(
    state, lastState, progress, myPlayer, myHeadX, myHeadY, cam.camX, cam.camY, fogRadiusWorld, dt, gridSize, showAllInMainCopy,
    tempFoodMatrices, tempFoodColors, tempFoodImageIndices
  );

  const portals = computePortals(state, lastState, progress, cam.camX, cam.camY, fogRadiusWorld, gridSize, showAllInMainCopy, calcFog, FOG_R, FOG_G, FOG_B);
  const blackHoles = computeBlackHoles(state, lastState, progress, cam.camX, cam.camY, fogRadiusWorld, gridSize, showAllInMainCopy);

  // Clear geometries
  bodyBufs.vertices.reset(); bodyBufs.uvs.reset(); bodyBufs.colors.reset(); bodyBufs.params.reset(); bodyBufs.indices.reset();
  eyes.reset();

  const activePlayers: any[] = [];
  const nicknames: any[] = [];
  processSnakes(state, lastState, progress, myId, gridSize, startLength, camera, particles, eyes, bodyBufs, calcFog, activePlayers, nicknames, fogRadiusWorld, showAllInMainCopy);

  particles.update(dt);
  const partBufs = particles.buildBuffers(FOG_R, FOG_G, FOG_B, calcFog);
  const eyeBufs = eyes.buildBuffers(FOG_R, FOG_G, FOG_B);

  const leaderboard = _buildLeaderboard(state, myId);
  const foodMinimapData = _buildFoodMinimap(state.foods);

  _addTombstoneNicknames(state, nicknames, gridSize);

  return _buildFrameResult(
    state, cam, fogRadiusWorld, foodCount, portals, blackHoles, bodyBufs, eyeBufs, eyes.eyeCount,
    eyes.pupilCount, partBufs, tempFoodMatrices, tempFoodColors, tempFoodImageIndices, nicknames, activePlayers,
    leaderboard, accumulatedKillEvents, foodMinimapData
  );
}

function _addTombstoneNicknames(state: GameState, nicknames: any[], gridSize: number) {
  if (!state.tombstones) return;
  for (let i = 0; i < state.tombstones.length; i++) {
    const tomb = state.tombstones[i];
    const tx = tomb.x * gridSize + gridSize / 2;
    const ty = -(tomb.y * gridSize + gridSize / 2);
    const opacity = Math.min(1.0, tomb.time_left / 5.0);
    nicknames.push({
      id: tomb.id,
      nickname: tomb.nickname,
      x: tx,
      y: ty,
      z: 5,
      opacity: Number(opacity.toFixed(2)),
      isTombstone: true
    });
  }
}
