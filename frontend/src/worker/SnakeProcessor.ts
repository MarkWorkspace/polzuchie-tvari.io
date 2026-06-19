// ROLE: Обработка сплайнов, мешей, глаз и частиц змеек на каждом кадре воркера. Не содержит рендеринг.
import type { GameState } from "../types/game";
import { CameraPredictor } from "./CameraPredictor";
import { ParticleComputer } from "./ParticleComputer";
import { EyeComputer } from "./EyeComputer";
import { appendSnakeMesh, type GeometryBuffers } from "./MeshBuilder";
import { computeSplinePaths } from "./SplineComputer";

function _processSingleSnake(
  playerId: string,
  p: any,
  oldP: any,
  isSelf: boolean,
  state: GameState,
  progress: number,
  gridSize: number,
  startLength: number,
  camera: CameraPredictor,
  particles: ParticleComputer,
  eyes: EyeComputer,
  bodyBufs: GeometryBuffers,
  calcFog: (wx: number, wy: number) => number,
  activePlayers: any[],
  nicknames: any[],
  baseHeadRadius: number,
  scoreThicknessScale: number,
  pitchAngle: number,
  showAllInMainCopy: boolean
): void {
  const activePlayerObj: any = { id: playerId, isMe: isSelf, nickname: p.nickname || "Игрок" };
  activePlayers.push(activePlayerObj);
  const mapW = state.server_world?.width ?? 100;
  const mapH = state.server_world?.height ?? 100;

  const pLength = Math.floor(p.body.length / 2);
  const pRadius = baseHeadRadius + Math.max(0, pLength - startLength) * 10.0 * scoreThicknessScale;

  const subPaths = computeSplinePaths(
    p, oldP ?? null, progress, mapW, mapH, camera.myVisualOffsetX, camera.myVisualOffsetY, isSelf, gridSize
  );

  const snakeZ = 0.0;
  appendSnakeMesh(subPaths, p.skin || "default", pRadius, gridSize, snakeZ, bodyBufs);

  if (subPaths.length > 0 && subPaths[0].pointsCount > 0) {
    let hx = subPaths[0].x[0];
    let hy = subPaths[0].y[0];

    // Wrap hx and hy relative to camera position to keep eyes/nicknames aligned across borders
    const mapW_geo = mapW * gridSize;
    const mapH_geo = mapH * gridSize;
    const camX = camera.localX * gridSize + gridSize / 2;
    const camY = -(camera.localY * gridSize + gridSize / 2);

    if (!showAllInMainCopy) {
      let dx = hx - camX;
      if (dx > mapW_geo / 2) dx -= mapW_geo;
      else if (dx < -mapW_geo / 2) dx += mapW_geo;
      hx = camX + dx;

      let dy = hy - camY;
      if (dy > mapH_geo / 2) dy -= mapH_geo;
      else if (dy < -mapH_geo / 2) dy += mapH_geo;
      hy = camY + dy;
    }

    const fogAmt = calcFog(hx, hy);
    // Derive head angle from spline geometry to stay in sync with body mesh
    let headAngle = p.angle;
    if (subPaths[0].pointsCount >= 2) {
      const dx = subPaths[0].x[0] - subPaths[0].x[1];
      const dy = subPaths[0].y[0] - subPaths[0].y[1];
      headAngle = -Math.atan2(dy, dx);
    }

    // Use wrapped hx, hy unless showAllInMainCopy is true (in which case they aren't wrapped anyway)
    // For self, subPaths[0] is already wrapped, but for others it's not.
    let finalHx = hx;
    let finalHy = hy;
    if (isSelf && subPaths.length > 0 && subPaths[0].pointsCount > 0) {
      finalHx = subPaths[0].x[0];
      finalHy = subPaths[0].y[0];
    }

    activePlayerObj.hx = finalHx;
    activePlayerObj.hy = finalHy;
    activePlayerObj.radius = pRadius;

    eyes.addEyes(finalHx, finalHy, pRadius * gridSize, snakeZ, headAngle, fogAmt);

    nicknames.push({
      id: playerId,
      nickname: p.nickname || "Игрок",
      x: finalHx,
      y: finalHy + pRadius * gridSize * 1.5,
      z: snakeZ + 0.5,
      rotationX: pitchAngle,
      opacity: 1.0 - fogAmt,
    });

    if (isSelf && (p.accelerating || camera.currentZoomOffset > 0.1) && subPaths.length > 0) {
      const lastPath = subPaths[subPaths.length - 1];
      const tx = lastPath.x[lastPath.pointsCount - 1];
      const ty = lastPath.y[lastPath.pointsCount - 1];
      particles.spawnParticlesForBooster(tx, ty, p.angle, pRadius * gridSize, p.skin || "#22c55e", p.speed_mult ?? 2.0);
    }
  }
}

export function processSnakes(
  state: GameState,
  lastState: GameState | null,
  progress: number,
  myId: string,
  gridSize: number,
  startLength: number,
  camera: CameraPredictor,
  particles: ParticleComputer,
  eyes: EyeComputer,
  bodyBufs: GeometryBuffers,
  calcFog: (wx: number, wy: number) => number,
  activePlayers: any[],
  nicknames: any[],
  fogRadiusWorld: number,
  showAllInMainCopy: boolean
): void {
  const baseHeadRadius = state.server_snake?.base_head_radius ?? 0.2;
  const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? 0.0005;
  const pitchAngle = (state.server_visual?.camera_pitch_angle ?? 55) * Math.PI / 180;

  for (const playerId in state.players) {
    const p = state.players[playerId];
    const oldP = lastState?.players[playerId];
    if (p.is_dead || !p.body || p.body.length === 0 || p.teleport_state === "in_transit") continue;

    const isSelf = playerId === myId;
    
    if (!isSelf && !showAllInMainCopy) {
      const pLength = Math.floor(p.body.length / 2);
      const mapW = state.server_world?.width ?? 100;
      const mapH = state.server_world?.height ?? 100;
      const mapW_geo = mapW * gridSize;
      const mapH_geo = mapH * gridSize;
      
      const camX = camera.localX * gridSize + gridSize / 2;
      const camY = -(camera.localY * gridSize + gridSize / 2);
      
      let hx = p.body[0] * gridSize + gridSize / 2;
      let hy = -(p.body[1] * gridSize + gridSize / 2);
      
      let dx = hx - camX;
      if (dx > mapW_geo / 2) dx -= mapW_geo;
      else if (dx < -mapW_geo / 2) dx += mapW_geo;
      
      let dy = hy - camY;
      if (dy > mapH_geo / 2) dy -= mapH_geo;
      else if (dy < -mapH_geo / 2) dy += mapH_geo;
      
      const dist = Math.sqrt(dx*dx + dy*dy);
      const safeRadius = fogRadiusWorld * 1.1 + (pLength * gridSize * 0.6);
      
      if (dist > safeRadius) {
        activePlayers.push({ id: playerId, isMe: false, nickname: p.nickname || "Игрок" });
        continue;
      }
    }

    _processSingleSnake(
      playerId, p, oldP, isSelf, state, progress, gridSize, startLength, camera,
      particles, eyes, bodyBufs, calcFog, activePlayers, nicknames,
      baseHeadRadius, scoreThicknessScale, pitchAngle, showAllInMainCopy
    );
  }
}
