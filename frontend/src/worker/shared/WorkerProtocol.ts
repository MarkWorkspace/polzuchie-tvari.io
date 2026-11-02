// ROLE: Типы wire-протокола main↔worker и контекстов вычисления кадра. Не содержит логики.

import type {
  BlackHole,
  Food,
  GameState,
  KillEvent,
  Player,
  Portal,
  ServerFoodConfig,
  ServerSimulationConfig,
  ServerSnakeConfig,
  ServerVisualConfig,
  ServerWorldConfig,
  Tombstone,
} from "../../types/game";
import type { CameraPredictor } from "../CameraPredictor";
import type { EyeComputer } from "../EyeComputer";
import type { GeometryBuffers } from "../MeshBuilder";
import type { ParticleComputer } from "../ParticleComputer";

export type WorkerConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/**
 * Player input forwarded with each frame request. The worker only consumes
 * `accelerating` for camera prediction; `turn`/`mode` travel for parity and are
 * optional so partial snapshots (legacy callers, unit tests) stay valid.
 */
export interface FrameInput {
  turn: number;
  accelerating?: boolean;
  mode?: string;
}

export interface SpectatorCam {
  x: number;
  y: number;
}

export interface ConnectMessage {
  type: "CONNECT";
  url: string;
}

export interface SendMessage {
  type: "SEND";
  data: string;
}

export interface CloseMessage {
  type: "CLOSE";
}

export interface FrameRequest {
  type: "REQUEST_FRAME";
  requestId: number;
  dt: number;
  myId: string;
  isSpectator: boolean;
  showAllInMainCopy: boolean;
  spectatorCam?: SpectatorCam;
  gridSize: number;
  localInput: FrameInput;
}

/** Every message the main thread may post to the worker. */
export type MainToWorker = ConnectMessage | SendMessage | CloseMessage | FrameRequest;

export interface StatusDetails {
  msg?: string;
  msgKey?: string;
  msgParams?: Record<string, unknown>;
  closeCode?: number;
}

export interface StatusMessage extends StatusDetails {
  type: "STATUS";
  status: WorkerConnectionStatus;
}

export interface DisconnectMessage {
  type: "DISCONNECT";
}

export interface PingMessage {
  type: "PING";
  latency: number;
}

export interface YourIdMessage {
  type: "YOUR_ID";
  your_id: string;
}

/** Lightweight player shape carried by `FRAME_DATA.gameState`. */
export interface FramePlayer {
  nickname?: string;
  skin?: string;
  score?: number;
  accelerating?: boolean;
  body_len: number;
  head_x: number;
  head_y: number;
  angle?: number;
  is_dead?: boolean;
  kills?: number;
  deaths?: number;
  teleport_state?: string;
}

/** `FRAME_DATA` game state: configs plus lightweight players, no full bodies. */
export interface FrameGameState {
  server_tick_rate?: number;
  server_world?: ServerWorldConfig;
  server_simulation?: ServerSimulationConfig;
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
  server_boost?: unknown;
  players: Record<string, FramePlayer>;
  foods: Food[];
  portals?: Portal[];
  black_holes?: BlackHole[];
  tombstones?: Tombstone[];
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
}

export interface ActivePlayerInfo {
  id: string;
  isMe: boolean;
  nickname: string;
  hx?: number;
  hy?: number;
  /** Tail tip in world units, useful for fading ground effects. */
  tailX?: number;
  tailY?: number;
  radius?: number;
  glowColor?: number;
}

export interface NicknameLabel {
  id: string;
  nickname: string;
  x: number;
  y: number;
  z: number;
  opacity: number;
  rotationX?: number;
  isTombstone?: boolean;
}

export interface EyeBuffers {
  eyeMatrices: Float32Array;
  eyeColors: Float32Array;
  pupilMatrices: Float32Array;
  pupilColors: Float32Array;
}

export interface ParticleBuffers {
  particleMatrices: Float32Array;
  particleColors: Float32Array;
  particleCount: number;
}

/** Full `FRAME_DATA` payload posted by the worker; `requestId` is set by the worker. */
export interface FrameDataMessage {
  type: "FRAME_DATA";
  requestId?: number;
  bodyVertices: Float32Array;
  bodyUVs: Float32Array;
  bodyColors: Float32Array;
  bodySnakeParams: Float32Array;
  bodyIndices: Uint32Array;
  eyeMatrices: Float32Array;
  eyeColors: Float32Array;
  eyeCount: number;
  pupilMatrices: Float32Array;
  pupilColors: Float32Array;
  pupilCount: number;
  particleMatrices: Float32Array;
  particleColors: Float32Array;
  particleCount: number;
  foodMatrices: Float32Array;
  foodColors: Float32Array;
  foodImageIndices: Int32Array;
  foodCount: number;
  portalDiskMatrices: Float32Array;
  portalDiskColors: Float32Array;
  portalRingMatrices: Float32Array;
  portalRingColors: Float32Array;
  portalCount: number;
  blackHoleCoreMatrices: Float32Array;
  blackHoleRingMatrices: Float32Array;
  blackHoleGravityMatrices: Float32Array;
  blackHoleCount: number;
  camX: number;
  camY: number;
  camAngle: number;
  fogRadiusWorld: number;
  nicknames: NicknameLabel[];
  activePlayers: ActivePlayerInfo[];
  leaderboard: LeaderboardEntry[];
  kill_events: KillEvent[];
  tombstones: Tombstone[];
  foodMinimapData: Float32Array;
  gameState: FrameGameState;
}

/** Request-scoped "no frame yet" reply; carries no camera/game state. */
export interface FrameUnavailableMessage {
  type: "FRAME_UNAVAILABLE";
  requestId?: number;
}

/** Every message the worker may post to the main thread. */
export type WorkerToMain =
  | StatusMessage
  | DisconnectMessage
  | PingMessage
  | YourIdMessage
  | FrameDataMessage
  | FrameUnavailableMessage;

/** Inputs of one `computeFrame` call. Replaces the former positional arguments. */
export interface FrameContext {
  dt: number;
  localInput: FrameInput;
  gridSize: number;
  state: GameState;
  lastState: GameState | null;
  progress: number;
  myId: string;
  isSpectator: boolean;
  showAllInMainCopy: boolean;
  spectatorCam?: SpectatorCam;
  camera: CameraPredictor;
  particles: ParticleComputer;
  eyes: EyeComputer;
  accumulatedKillEvents: KillEvent[];
  bodyBufs: GeometryBuffers;
  tempFoodMatrices: Float32Array;
  tempFoodColors: Float32Array;
  tempFoodImageIndices: Int32Array;
}

/** Inputs of one `_processSingleSnake` call. */
export interface SnakeContext {
  playerId: string;
  p: Player;
  oldP: Player | undefined;
  isSelf: boolean;
  state: GameState;
  progress: number;
  gridSize: number;
  startLength: number;
  camera: CameraPredictor;
  particles: ParticleComputer;
  eyes: EyeComputer;
  bodyBufs: GeometryBuffers;
  calcFog: (wx: number, wy: number) => number;
  activePlayers: ActivePlayerInfo[];
  nicknames: NicknameLabel[];
  baseHeadRadius: number;
  scoreThicknessScale: number;
  pitchAngle: number;
  showAllInMainCopy: boolean;
}

/** Inputs of the per-frame snake pass that feeds `SnakeContext`. */
export interface SnakeSceneContext {
  state: GameState;
  lastState: GameState | null;
  progress: number;
  myId: string;
  gridSize: number;
  startLength: number;
  camera: CameraPredictor;
  particles: ParticleComputer;
  eyes: EyeComputer;
  bodyBufs: GeometryBuffers;
  calcFog: (wx: number, wy: number) => number;
  activePlayers: ActivePlayerInfo[];
  nicknames: NicknameLabel[];
  fogRadiusWorld: number;
  wrapAll: boolean;
}
