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
  pitchAngle: number
): void {
  activePlayers.push({ id: playerId, isMe: isSelf, nickname: p.nickname || "Игрок" });
  const mapW = state.server_world?.width ?? 100;
  const mapH = state.server_world?.height ?? 100;

  const pLength = p.body.length;
  const pRadius = baseHeadRadius + Math.max(0, pLength - startLength) * 10.0 * scoreThicknessScale;

  const subPaths = computeSplinePaths(
    p, oldP ?? null, progress, mapW, mapH, camera.myVisualOffsetX, camera.myVisualOffsetY, isSelf, gridSize
  );

  const snakeZ = 0.0;
  appendSnakeMesh(subPaths, p.skin || "default", pRadius, gridSize, snakeZ, bodyBufs);

  if (subPaths.length > 0 && subPaths[0].pointsCount > 0) {
    const hx = subPaths[0].x[0];
    const hy = subPaths[0].y[0];
    const fogAmt = calcFog(hx, hy);
    const headAngle = isSelf ? (camera.localAngle ?? p.angle) : p.angle;

    eyes.addEyes(hx, hy, pRadius * gridSize, snakeZ, headAngle, fogAmt);

    nicknames.push({
      id: playerId,
      nickname: p.nickname || "Игрок",
      x: hx,
      y: hy + pRadius * gridSize * 1.5,
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
  nicknames: any[]
): void {
  const baseHeadRadius = state.server_snake?.base_head_radius ?? 0.2;
  const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? 0.0005;
  const pitchAngle = (state.server_visual?.camera_pitch_angle ?? 55) * Math.PI / 180;

  for (const playerId in state.players) {
    const p = state.players[playerId];
    const oldP = lastState?.players[playerId];
    if (p.is_dead || !p.body || p.body.length === 0 || p.teleport_state === "in_transit") continue;

    const isSelf = playerId === myId;
    _processSingleSnake(
      playerId, p, oldP, isSelf, state, progress, gridSize, startLength, camera,
      particles, eyes, bodyBufs, calcFog, activePlayers, nicknames,
      baseHeadRadius, scoreThicknessScale, pitchAngle
    );
  }
}
