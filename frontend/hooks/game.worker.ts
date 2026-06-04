import { decode } from "@msgpack/msgpack";
import { GameState, Player, Food } from "../types/game";
import {
  DEFAULT_SERVER_TICK_RATE,
  MAX_TURN_SPEED_DEG,
  MIN_TURN_RADIUS,
  TURN_RADIUS_THICKNESS_COEFF,
  BASE_HEAD_RADIUS,
  SCORE_THICKNESS_SCALE,
  CAMERA_ZOOM_OUT_COEFF,
  MIN_FOG_RADIUS,
  FOG_SCORE_EXPANSION_COEFF,
  BASE_SPEED_PER_SECOND,
  TURN_IDLE_SMOOTHING_AT_20HZ,
  TURN_ACTIVE_SMOOTHING_AT_20HZ,
  frameSmoothing,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  gridSize
} from "../components/game/constants";

const ctx: Worker = self as any;

let socket: WebSocket | null = null;
let reconnectTimer: any = null;
let pingInterval: any = null;
let reconnectAttempt = 0;
let isCleaningUp = false;
let myId = "";

let gameState: GameState | null = null;
let lastGameState: GameState | null = null;
const foodMap = new Map<number, Food>();
const stateQueue: { time: number; state: GameState }[] = [];
let workerRenderTime: number | null = null;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  life: number;
}
const activeParticles: Particle[] = [];
let accumulatedKillEvents: any[] = [];

async function decompress(bytes: Uint8Array): Promise<ArrayBuffer> {
  const response = new Response(bytes as any);
  if (!response.body) throw new Error("Body is null");
  const decompressedStream = response.body.pipeThrough(new DecompressionStream("deflate"));
  return new Response(decompressedStream).arrayBuffer();
}

function parsePoints(arr: any): { x: number; y: number }[] {
  if (!arr) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === 'number') {
    const points: { x: number; y: number }[] = [];
    const len = arr.length;
    for (let i = 0; i < len - 1; i += 2) {
      const px = arr[i];
      const py = arr[i+1];
      if (typeof px === 'number' && typeof py === 'number' && !isNaN(px) && !isNaN(py)) {
        points.push({ x: px, y: py });
      }
    }
    return points;
  }
  return arr;
}

// Formula evaluation and Color helpers
const colorCache = new Map<string, number>();
function parseColor(colorStr: string): number {
  if (!colorStr) return 0x22c55e;
  const cached = colorCache.get(colorStr);
  if (cached !== undefined) return cached;
  const parsed = parseInt(colorStr.replace('#', '0x'), 16) || 0x22c55e;
  colorCache.set(colorStr, parsed);
  return parsed;
}

class FormulaParser {
  private tokens: string[] = [];
  private pos = 0;

  constructor(expression: string, s: number, l: number) {
    const regex = /\d+(?:\.\d+)?|[a-z_][a-z0-9_]*|[\+\-\*\/\^,\(\)]/gi;
    this.tokens = expression.match(regex) || [];
    this.pos = 0;
    
    for (let i = 0; i < this.tokens.length; i++) {
      const t = this.tokens[i].toLowerCase();
      if (t === "s" || t === "score") {
        this.tokens[i] = String(s);
      } else if (t === "l" || t === "len" || t === "length") {
        this.tokens[i] = String(l);
      } else if (t === "pi") {
        this.tokens[i] = String(Math.PI);
      } else if (t === "e") {
        this.tokens[i] = String(Math.E);
      }
    }
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(expected?: string): string {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");
    if (expected && token !== expected) throw new Error(`Expected token ${expected}`);
    this.pos++;
    return token;
  }

  public parse(): number {
    try {
      const val = this.parseExpression();
      if (this.peek() !== null) throw new Error("Extra tokens at end");
      return isNaN(val) ? 10.0 : val;
    } catch {
      return 10.0;
    }
  }

  private parseExpression(): number {
    let val = this.parseTerm();
    while (true) {
      const op = this.peek();
      if (op === "+" || op === "-") {
        this.consume();
        const rhs = this.parseTerm();
        val = op === "+" ? val + rhs : val - rhs;
      } else {
        break;
      }
    }
    return val;
  }

  private parseTerm(): number {
    let val = this.parseFactor();
    while (true) {
      const op = this.peek();
      if (op === "*" || op === "/") {
        this.consume();
        const rhs = this.parseFactor();
        val = op === "*" ? val * rhs : val / (rhs === 0 ? 0.001 : rhs);
      } else {
        break;
      }
    }
    return val;
  }

  private parseFactor(): number {
    let val = this.parsePrimary();
    while (this.peek() === "^") {
      this.consume();
      const exponent = this.parsePrimary();
      val = Math.pow(val, exponent);
    }
    return val;
  }

  private parsePrimary(): number {
    const token = this.consume();
    if (token === "(") {
      const val = this.parseExpression();
      this.consume(")");
      return val;
    }

    if (token === "-") {
      return -this.parsePrimary();
    }
    if (token === "+") {
      return this.parsePrimary();
    }

    const num = Number(token);
    if (!isNaN(num)) {
      return num;
    }

    const func = token.toLowerCase();
    if (["sin", "cos", "tan", "log", "log10", "sqrt", "abs", "exp", "min", "max", "pow"].includes(func)) {
      this.consume("(");
      const args: number[] = [];
      args.push(this.parseExpression());
      while (this.peek() === ",") {
        this.consume();
        args.push(this.parseExpression());
      }
      this.consume(")");

      switch (func) {
        case "sin": return Math.sin(args[0]);
        case "cos": return Math.cos(args[0]);
        case "tan": return Math.tan(args[0]);
        case "log": return Math.log(Math.max(0.001, args[0]));
        case "log10": return Math.log10(Math.max(0.001, args[0]));
        case "sqrt": return Math.sqrt(Math.max(0.0, args[0]));
        case "abs": return Math.abs(args[0]);
        case "exp": return Math.exp(args[0]);
        case "min": return Math.min(...args);
        case "max": return Math.max(...args);
        case "pow": return Math.pow(args[0], args[1] || 0);
      }
    }

    return 0.0;
  }
}

function evaluateFormula(formula: string | number, score: number, length: number): number {
  if (typeof formula === "number") return formula;
  if (!formula || formula === "") return 10.0;
  const parser = new FormulaParser(formula, score, length);
  const result = parser.parse();
  return Math.max(0.1, result);
}

function randomRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function writeMatrix(array: Float32Array, index: number, tx: number, ty: number, tz: number, s: number) {
  const idx = index * 16;
  array[idx + 0] = s;
  array[idx + 1] = 0;
  array[idx + 2] = 0;
  array[idx + 3] = 0;
  
  array[idx + 4] = 0;
  array[idx + 5] = s;
  array[idx + 6] = 0;
  array[idx + 7] = 0;
  
  array[idx + 8] = 0;
  array[idx + 9] = 0;
  array[idx + 10] = s;
  array[idx + 11] = 0;
  
  array[idx + 12] = tx;
  array[idx + 13] = ty;
  array[idx + 14] = tz;
  array[idx + 15] = 1;
}

const camState = {
  localAngle: null as number | null,
  localCurrentTurn: 0.0,
  currentZoomOffset: 0.0,
};

function handleRequestFrame(msg: any) {
  const { dt, myId, cameraMode, localInput } = msg;

  const queue = stateQueue;
  if (!gameState) {
    ctx.postMessage({
      type: "FRAME_DATA",
      bodyVertices: new Float32Array(0),
      bodyUVs: new Float32Array(0),
      bodyColors: new Float32Array(0),
      bodySnakeParams: new Float32Array(0),
      bodyIndices: new Uint32Array(0),
      shadowVertices: new Float32Array(0),
      shadowUVs: new Float32Array(0),
      shadowColors: new Float32Array(0),
      shadowSnakeParams: new Float32Array(0),
      shadowIndices: new Uint32Array(0),
      eyeMatrices: new Float32Array(0),
      eyeColors: new Float32Array(0),
      eyeCount: 0,
      pupilMatrices: new Float32Array(0),
      pupilColors: new Float32Array(0),
      pupilCount: 0,
      particleMatrices: new Float32Array(0),
      particleColors: new Float32Array(0),
      particleCount: 0,
      foodMatrices: new Float32Array(0),
      foodColors: new Float32Array(0),
      foodShadowMatrices: new Float32Array(0),
      foodCount: 0,
      portalDiskMatrices: new Float32Array(0),
      portalDiskColors: new Float32Array(0),
      portalRingMatrices: new Float32Array(0),
      portalRingColors: new Float32Array(0),
      portalCount: 0,
      blackHoleCoreMatrices: new Float32Array(0),
      blackHoleRingMatrices: new Float32Array(0),
      blackHoleGravityMatrices: new Float32Array(0),
      blackHoleCount: 0,
      camX: 0,
      camY: 0,
      camAngle: 0,
      fogRadiusWorld: 900,
      nicknames: [],
      activePlayers: [],
      gameState: null,
      leaderboard: [],
      kill_events: []
    });
    return;
  }

  const serverSimulation = gameState.server_simulation;
  const serverTickRate = serverSimulation?.tick_rate || gameState.server_tick_rate || DEFAULT_SERVER_TICK_RATE;
  const serverTickMs = 1000 / serverTickRate;

  let state: GameState | null = null;
  let lastState: GameState | null = null;
  let progress = 1.0;

  if (queue.length >= 2) {
    const targetDelay = 3.0 * serverTickMs;
    if (workerRenderTime === null) {
      workerRenderTime = queue[queue.length - 1].time - targetDelay;
    }

    const newestTime = queue[queue.length - 1].time;
    const oldestTime = queue[0].time;

    const currentDelay = newestTime - workerRenderTime;
    const error = currentDelay - targetDelay;
    let playbackSpeed = 1.0 + error * 0.005;
    playbackSpeed = Math.max(0.5, Math.min(1.5, playbackSpeed));

    if (workerRenderTime < oldestTime) {
      workerRenderTime = oldestTime;
    }
    if (workerRenderTime > newestTime) {
      workerRenderTime = newestTime;
      playbackSpeed = 0.0;
    }

    workerRenderTime += dt * 1000 * playbackSpeed;

    let indexA = 0;
    for (let i = 0; i < queue.length - 1; i++) {
      if (queue[i].time <= workerRenderTime && workerRenderTime <= queue[i + 1].time) {
        indexA = i;
        break;
      }
      if (queue[i + 1].time > workerRenderTime) {
        indexA = i;
        break;
      }
    }

    const stateA = queue[indexA].state;
    const stateB = queue[indexA + 1].state;
    const timeA = queue[indexA].time;
    const timeB = queue[indexA + 1].time;

    lastState = stateA;
    state = stateB;

    const denom = timeB - timeA;
    progress = denom > 0.001 ? Math.max(0.0, Math.min(1.0, (workerRenderTime - timeA) / denom)) : 1.0;
  } else {
    state = gameState;
    lastState = lastGameState || gameState;
    progress = 1.0;
  }

  if (!state) return;
  const mapW = state.server_world?.width ?? WORLD_WIDTH;
  const mapH = state.server_world?.height ?? WORLD_HEIGHT;

  const myPlayer = state.players[myId];
  const serverSnakeConfig = state.server_snake;
  const startLength = serverSnakeConfig?.start_length ?? 5;
  const baseHeadRadius = serverSnakeConfig?.base_head_radius ?? BASE_HEAD_RADIUS;
  const scoreThicknessScale = serverSnakeConfig?.score_thickness_scale ?? SCORE_THICKNESS_SCALE;
  const cameraZoomOutCoeff = serverSnakeConfig?.camera_zoom_out_coeff ?? CAMERA_ZOOM_OUT_COEFF;

  let myLength = startLength;
  if (myPlayer && myPlayer.body) {
    myLength = myPlayer.body.length;
  }
  const myEffectiveLengthGained = Math.max(0, myLength - startLength);

  const minFog = state.server_visual?.min_fog_radius ?? MIN_FOG_RADIUS;
  const expansion = state.server_visual?.fog_score_expansion_coeff ?? FOG_SCORE_EXPANSION_COEFF;
  const fogRadiusWorld = minFog + (myEffectiveLengthGained * 10.0) * expansion;

  let camX = (mapW * gridSize) / 2;
  let camY = -(mapH * gridSize) / 2;
  let camAngle = 0.0;

  const baseSpeedPerSecond = state.server_simulation?.base_speed_per_second ?? BASE_SPEED_PER_SECOND;
  const minTurnRadius = state.server_simulation?.min_turn_radius ?? MIN_TURN_RADIUS;
  const turnRadiusThicknessCoeff = state.server_simulation?.turn_radius_thickness_coeff ?? TURN_RADIUS_THICKNESS_COEFF;
  const maxTurnSpeedDeg = state.server_simulation?.max_turn_speed_deg_per_second ?? MAX_TURN_SPEED_DEG;

  if (myPlayer) {
    if (camState.localAngle === null) {
      camState.localAngle = myPlayer.angle;
    }
    
    const myHeadRadius = baseHeadRadius + (myEffectiveLengthGained * 10.0) * scoreThicknessScale;
    const effectiveRadius = minTurnRadius + myHeadRadius * turnRadiusThicknessCoeff;
    const maxTurnFromRadius = baseSpeedPerSecond / Math.max(effectiveRadius, 0.01);
    const turnPerTick = Math.min(maxTurnSpeedDeg * Math.PI / 180, maxTurnFromRadius) / serverTickRate;

    const targetTurn = localInput.turn * turnPerTick;
    if (localInput.mode === "mouse" || localInput.mode === "tilt") {
      camState.localCurrentTurn = targetTurn;
    } else {
      const smoothing = localInput.turn === 0 ? (serverSimulation?.turn_idle_smoothing_at_20hz ?? TURN_IDLE_SMOOTHING_AT_20HZ) : (serverSimulation?.turn_active_smoothing_at_20hz ?? TURN_ACTIVE_SMOOTHING_AT_20HZ);
      camState.localCurrentTurn += (targetTurn - camState.localCurrentTurn) * frameSmoothing(smoothing, dt);
    }
    camState.localAngle += camState.localCurrentTurn * dt * serverTickRate;

    const angleDiff = Math.atan2(Math.sin(myPlayer.angle - camState.localAngle), Math.cos(myPlayer.angle - camState.localAngle));
    if (Math.abs(angleDiff) > Math.PI / 2) {
      camState.localAngle = myPlayer.angle;
    } else {
      camState.localAngle += angleDiff * 0.1;
    }

    if (myPlayer.accelerating || localInput.accelerating) {
      camState.currentZoomOffset = Math.min(1, camState.currentZoomOffset + 3.0 * dt);
    } else {
      camState.currentZoomOffset = Math.max(0, camState.currentZoomOffset - 3.0 * dt);
    }

    const target = myPlayer.body[0];
    let start = target;
    const oldBody = lastState?.players[myId]?.body;
    if (oldBody && oldBody.length > 0) start = oldBody[0];
    if (Math.abs(target.x - start.x) > mapW / 2 || Math.abs(target.y - start.y) > mapH / 2) start = target;

    camX = (start.x + (target.x - start.x) * progress) * gridSize + gridSize / 2;
    camY = -((start.y + (target.y - start.y) * progress) * gridSize + gridSize / 2);
    camAngle = camState.localAngle;
  }

  const FOG_R = 12 / 255;
  const FOG_G = 12 / 255;
  const FOG_B = 15 / 255;

  const calcFogAmount = (wx: number, wy: number) => {
    const dist = Math.sqrt((wx - camX)**2 + (wy - camY)**2);
    const start = fogRadiusWorld * 0.75;
    const end = fogRadiusWorld * 0.95;
    if (dist >= end) return 1.0;
    if (dist <= start) return 0.0;
    return (dist - start) / (end - start);
  };

  // 1. Food Mesh Matrices
  const foods = state.foods || [];
  const lastFoodMap = new Map<number, Food>();
  if (lastState && lastState.foods) {
    for (let i = 0; i < lastState.foods.length; i++) {
      const lf = lastState.foods[i];
      lastFoodMap.set(lf.id, lf);
    }
  }

  const baseRadius = state.server_food?.base_radius ?? 0.2;
  const radiusValueScale = state.server_food?.radius_value_scale ?? 0.1;

  const visibleFoodsList: { fx: number, fy: number, r: number, color: number }[] = [];
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    let fx = food.x;
    let fy = food.y;

    const lf = lastFoodMap.get(food.id);
    if (lf) {
      let dx = food.x - lf.x;
      let dy = food.y - lf.y;
      if (Math.abs(dx) > mapW / 2) {
        fx = food.x;
      } else {
        fx = lf.x + dx * progress;
      }
      if (Math.abs(dy) > mapH / 2) {
        fy = food.y;
      } else {
        fy = lf.y + dy * progress;
      }
    }

    const foodRadius = (baseRadius + Math.sqrt(food.value) * radiusValueScale) * gridSize;
    const wx = fx * gridSize + gridSize/2;
    const wy = -(fy * gridSize + gridSize/2);

    const distToCamSq = (wx - camX)**2 + (wy - camY)**2;
    if (distToCamSq > (fogRadiusWorld * 1.05) ** 2) {
      continue;
    }
    
    visibleFoodsList.push({
      fx: wx,
      fy: wy,
      r: foodRadius,
      color: parseColor(food.color || '#ef4444')
    });
  }

  const foodCount = visibleFoodsList.length;
  const foodMatrices = new Float32Array(foodCount * 16);
  const foodColors = new Float32Array(foodCount * 3);
  const foodShadowMatrices = new Float32Array(foodCount * 16);

  for (let i = 0; i < foodCount; i++) {
    const f = visibleFoodsList[i];
    writeMatrix(foodShadowMatrices, i, f.fx, f.fy, 0.2, f.r * 2.4);
    writeMatrix(foodMatrices, i, f.fx, f.fy, 1.5, f.r * 1.666);

    const fr = ((f.color >> 16) & 255) / 255;
    const fg = ((f.color >> 8) & 255) / 255;
    const fb = (f.color & 255) / 255;

    const fogAmt = calcFogAmount(f.fx, f.fy);
    const finalR = fr + (FOG_R - fr) * fogAmt;
    const finalG = fg + (FOG_G - fg) * fogAmt;
    const finalB = fb + (FOG_B - fb) * fogAmt;

    const colorIdx = i * 3;
    foodColors[colorIdx + 0] = finalR;
    foodColors[colorIdx + 1] = finalG;
    foodColors[colorIdx + 2] = finalB;
  }

  // 2. Portals
  const portals = state.portals || [];
  const visiblePortalsList: { wx: number, wy: number, r: number, color: number }[] = [];
  if (state.server_world?.portals_enabled !== 0) {
    for (let i = 0; i < portals.length; i++) {
      const p = portals[i];
      const radius = p.radius * gridSize;
      const color = parseColor(p.color || '#38bdf8');
      
      const wx1 = p.x1 * gridSize;
      const wy1 = -p.y1 * gridSize;
      if ((wx1 - camX)**2 + (wy1 - camY)**2 <= (fogRadiusWorld * 1.2) ** 2) {
        visiblePortalsList.push({ wx: wx1, wy: wy1, r: radius, color });
      }

      const wx2 = p.x2 * gridSize;
      const wy2 = -p.y2 * gridSize;
      if ((wx2 - camX)**2 + (wy2 - camY)**2 <= (fogRadiusWorld * 1.2) ** 2) {
        visiblePortalsList.push({ wx: wx2, wy: wy2, r: radius, color });
      }
    }
  }

  const portalCount = visiblePortalsList.length;
  const portalDiskMatrices = new Float32Array(portalCount * 16);
  const portalDiskColors = new Float32Array(portalCount * 3);
  const portalRingMatrices = new Float32Array(portalCount * 16);
  const portalRingColors = new Float32Array(portalCount * 3);

  for (let i = 0; i < portalCount; i++) {
    const p = visiblePortalsList[i];
    writeMatrix(portalDiskMatrices, i, p.wx, p.wy, 0.3, p.r);
    writeMatrix(portalRingMatrices, i, p.wx, p.wy, 0.32, p.r);

    const pr = ((p.color >> 16) & 255) / 255;
    const pg = ((p.color >> 8) & 255) / 255;
    const pb = (p.color & 255) / 255;

    const fogAmt = calcFogAmount(p.wx, p.wy);
    const finalR = pr + (FOG_R - pr) * fogAmt;
    const finalG = pg + (FOG_G - pg) * fogAmt;
    const finalB = pb + (FOG_B - pb) * fogAmt;

    const cIdx = i * 3;
    portalDiskColors[cIdx + 0] = finalR;
    portalDiskColors[cIdx + 1] = finalG;
    portalDiskColors[cIdx + 2] = finalB;

    portalRingColors[cIdx + 0] = finalR;
    portalRingColors[cIdx + 1] = finalG;
    portalRingColors[cIdx + 2] = finalB;
  }

  // 3. Black Holes
  const blackHoles = state.black_holes || [];
  const lastBhMap = new Map<any, any>();
  if (lastState && lastState.black_holes) {
    for (let i = 0; i < lastState.black_holes.length; i++) {
      const bh = lastState.black_holes[i];
      lastBhMap.set(bh.id, bh);
    }
  }

  const visibleBlackHolesList: { wx: number, wy: number, pullRadius: number, killRadius: number }[] = [];
  if (state.server_world?.black_holes_enabled !== 0) {
    for (let i = 0; i < blackHoles.length; i++) {
      const bh = blackHoles[i];
      let pullRadius = bh.pull_radius;
      let killRadius = bh.kill_radius;

      const lastBh = lastBhMap.get(bh.id);
      if (lastBh) {
        pullRadius = lastBh.pull_radius + (bh.pull_radius - lastBh.pull_radius) * progress;
        killRadius = lastBh.kill_radius + (bh.kill_radius - lastBh.kill_radius) * progress;
      } else {
        pullRadius = bh.pull_radius * progress;
        killRadius = bh.kill_radius * progress;
      }

      const wx = bh.x * gridSize;
      const wy = -bh.y * gridSize;

      if ((wx - camX)**2 + (wy - camY)**2 <= (fogRadiusWorld * 1.2) ** 2) {
        visibleBlackHolesList.push({ wx, wy, pullRadius, killRadius });
      }
    }
  }

  const blackHoleCount = visibleBlackHolesList.length;
  const blackHoleCoreMatrices = new Float32Array(blackHoleCount * 16);
  const blackHoleRingMatrices = new Float32Array(blackHoleCount * 16);
  const blackHoleGravityMatrices = new Float32Array(blackHoleCount * 16);

  for (let i = 0; i < blackHoleCount; i++) {
    const bh = visibleBlackHolesList[i];
    writeMatrix(blackHoleGravityMatrices, i, bh.wx, bh.wy, 0.1, bh.pullRadius * gridSize);
    writeMatrix(blackHoleRingMatrices, i, bh.wx, bh.wy, 0.4, bh.killRadius * gridSize * 1.5);
    writeMatrix(blackHoleCoreMatrices, i, bh.wx, bh.wy, 0.42, bh.killRadius * gridSize);
  }

  // 4. Snakes
  const bodyVerticesTemp: number[] = [];
  const bodyUVsTemp: number[] = [];
  const bodyColorsTemp: number[] = [];
  const bodySnakeParamsTemp: number[] = [];
  const bodyIndicesTemp: number[] = [];

  const shadowVerticesTemp: number[] = [];
  const shadowUVsTemp: number[] = [];
  const shadowColorsTemp: number[] = [];
  const shadowSnakeParamsTemp: number[] = [];
  const shadowIndicesTemp: number[] = [];

  const activePlayers: { id: string; isMe: boolean; nickname: string }[] = [];
  const nicknames: { id: string; nickname: string; x: number; y: number; z: number; rotationX: number; opacity: number }[] = [];

  // Temporary arrays for eyes and pupils
  const tempEyeList: { ex: number, ey: number, ez: number, r: number, color: number }[] = [];
  const tempPupilList: { px: number, py: number, pz: number, r: number, color: number }[] = [];

  const pitchAngle = (state.server_visual?.camera_pitch_angle ?? 55) * Math.PI / 180;

  for (const playerId in state.players) {
    const p = state.players[playerId];
    const oldP = lastState?.players[playerId];
    if (!p.body || p.body.length === 0) continue;

    const isSelf = playerId === myId;
    activePlayers.push({ id: playerId, isMe: isSelf, nickname: p.nickname || "Игрок" });

    let segments: { x: number; y: number }[] = [];
    const currentLength = p.body.length;
    const effectiveLengthGained = Math.max(0, currentLength - startLength);
    const radius = baseHeadRadius + effectiveLengthGained * 10.0 * scoreThicknessScale;

    if (oldP && oldP.body && oldP.body.length > 0) {
      const count = Math.max(p.body.length, oldP.body.length);
      for (let i = 0; i < count; i++) {
        const ptA = oldP.body[i] || oldP.body[oldP.body.length - 1];
        const ptB = p.body[i] || p.body[p.body.length - 1];
        
        let ax = ptA.x;
        let ay = ptA.y;
        let bx = ptB.x;
        let by = ptB.y;

        let dx = bx - ax;
        let dy = by - ay;
        
        if (Math.abs(dx) > mapW / 2) {
          bx = ptB.x;
        } else {
          bx = ax + dx * progress;
        }
        if (Math.abs(dy) > mapH / 2) {
          by = ptB.y;
        } else {
          by = ay + dy * progress;
        }

        segments.push({ x: bx, y: by });
      }
    } else {
      segments = p.body.map(pt => ({ x: pt.x, y: pt.y }));
    }

    const headPos = segments[0];
    const hx_scr = headPos.x * gridSize + gridSize/2;
    const hy_scr = -(headPos.y * gridSize + gridSize/2);
    const distSq = (hx_scr - camX)**2 + (hy_scr - camY)**2;
    if (distSq > (fogRadiusWorld * 1.05) ** 2) {
      continue;
    }

    let skinTypeVal = 1.0;
    let skinColHex = '#22c55e';
    
    if (p.skin === 'zebra') skinTypeVal = 2.0;
    else if (p.skin === 'tiger') skinTypeVal = 3.0;
    else if (p.skin === 'cyberpunk') skinTypeVal = 4.0;
    else if (p.skin === 'rainbow') skinTypeVal = 5.0;
    else {
      skinColHex = p.skin || '#22c55e';
    }
    
    const skinColorInt = parseColor(skinColHex);
    const skinR = ((skinColorInt >> 16) & 255) / 255;
    const skinG = ((skinColorInt >> 8) & 255) / 255;
    const skinB = (skinColorInt & 255) / 255;

    const parsedColorObj = { r: skinR, g: skinG, b: skinB };
    if (skinTypeVal > 1.5) {
      parsedColorObj.r = skinTypeVal;
    }

    let splineDensity = 2;
    if (currentLength > 40) {
      splineDensity = 1;
    }

    const subPaths: { x: number; y: number }[][] = [];
    let currentSubPath: { x: number; y: number }[] = [segments[0]];

    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1];
      const curr = segments[i];
      
      let dx = curr.x - prev.x;
      let dy = curr.y - prev.y;
      
      if (Math.abs(dx) > mapW / 2 || Math.abs(dy) > mapH / 2) {
        subPaths.push(currentSubPath);
        currentSubPath = [curr];
      } else {
        currentSubPath.push(curr);
      }
    }
    subPaths.push(currentSubPath);

    const zMultiplier = 0.001;
    const snakeZ = 2.0 + currentLength * zMultiplier;
    const shadowZ = 0.2 + currentLength * zMultiplier;

    for (let pathIdx = 0; pathIdx < subPaths.length; pathIdx++) {
      const path = subPaths[pathIdx];
      if (path.length < 2) continue;

      const smoothPoints: { x: number; y: number; coord: number }[] = [];
      const startWx = path[0].x * gridSize + gridSize/2;
      const startWy = -(path[0].y * gridSize + gridSize/2);
      smoothPoints.push({ x: startWx, y: startWy, coord: 0.0 });
      
      let accumulatedDistance = 0.0;
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        
        const prevWx = prev.x * gridSize + gridSize/2;
        const prevWy = -(prev.y * gridSize + gridSize/2);
        const currWx = curr.x * gridSize + gridSize/2;
        const currWy = -(curr.y * gridSize + gridSize/2);

        const segDist = Math.hypot(currWx - prevWx, currWy - prevWy);
        accumulatedDistance += segDist;

        if (splineDensity > 1) {
          const midWx = prevWx + (currWx - prevWx) * 0.5;
          const midWy = prevWy + (currWy - prevWy) * 0.5;
          smoothPoints.push({ x: midWx, y: midWy, coord: accumulatedDistance - segDist * 0.5 });
        }
        smoothPoints.push({ x: currWx, y: currWy, coord: accumulatedDistance });
      }

      const pointsCount = smoothPoints.length;
      if (pointsCount < 2) continue;

      const baseVIdx = bodyVerticesTemp.length / 3;
      const baseVIdxShadow = shadowVerticesTemp.length / 3;

      const normals: { x: number; y: number }[] = new Array(pointsCount);
      for (let i = 0; i < pointsCount; i++) {
        const pt = smoothPoints[i];
        let nx = 0.0;
        let ny = 0.0;

        if (i === 0) {
          const nextPt = smoothPoints[1];
          const dx = nextPt.x - pt.x;
          const dy = nextPt.y - pt.y;
          const len = Math.hypot(dx, dy) || 0.001;
          nx = -dy / len;
          ny = dx / len;
        } else if (i === pointsCount - 1) {
          const prevPt = smoothPoints[pointsCount - 2];
          const dx = pt.x - prevPt.x;
          const dy = pt.y - prevPt.y;
          const len = Math.hypot(dx, dy) || 0.001;
          nx = -dy / len;
          ny = dx / len;
        } else {
          const prevPt = smoothPoints[i - 1];
          const nextPt = smoothPoints[i + 1];
          
          const dx1 = pt.x - prevPt.x;
          const dy1 = pt.y - prevPt.y;
          const len1 = Math.hypot(dx1, dy1) || 0.001;
          
          const dx2 = nextPt.x - pt.x;
          const dy2 = nextPt.y - pt.y;
          const len2 = Math.hypot(dx2, dy2) || 0.001;

          const n1x = -dy1 / len1;
          const n1y = dx1 / len1;
          const n2x = -dy2 / len2;
          const n2y = dx2 / len2;

          nx = n1x + n2x;
          ny = n1y + n2y;
          const nlen = Math.hypot(nx, ny) || 0.001;
          nx /= nlen;
          ny /= nlen;
        }
        normals[i] = { x: nx, y: ny };
      }

      interface PathNode {
        x: number;
        y: number;
        nx: number;
        ny: number;
        uvY: number;
      }
      
      const pathNodes: PathNode[] = [];
      const totalWidth = radius * gridSize;
      const shadowRadius = totalWidth + 3.2;
      let shadowHeadExtension: { x: number; y: number; uvY: number } | null = null;
      let shadowTailExtension: { x: number; y: number; uvY: number } | null = null;

      // 1. Add head extension node if it's the first subpath of the snake (rounded cap)
      if (pathIdx === 0) {
        const p0 = smoothPoints[0];
        const p1 = smoothPoints[1];
        const dx = p0.x - p1.x;
        const dy = p0.y - p1.y;
        const len = Math.hypot(dx, dy) || 0.001;
        const dirX = dx / len;
        const dirY = dy / len;
        shadowHeadExtension = {
          x: p0.x + dirX * shadowRadius,
          y: p0.y + dirY * shadowRadius,
          uvY: -shadowRadius
        };
        
        pathNodes.push({
          x: p0.x + dirX * totalWidth,
          y: p0.y + dirY * totalWidth,
          nx: normals[0].x,
          ny: normals[0].y,
          uvY: -totalWidth
        });
      }

      // 2. Add standard smoothPoints nodes
      for (let i = 0; i < pointsCount; i++) {
        const pt = smoothPoints[i];
        pathNodes.push({
          x: pt.x,
          y: pt.y,
          nx: normals[i].x,
          ny: normals[i].y,
          uvY: pt.coord
        });
      }

      // 3. Add tail extension node if it's the last subpath of the snake (rounded cap)
      if (pathIdx === subPaths.length - 1) {
        const pLast = smoothPoints[pointsCount - 1];
        const pPrev = smoothPoints[pointsCount - 2];
        const dx = pLast.x - pPrev.x;
        const dy = pLast.y - pPrev.y;
        const len = Math.hypot(dx, dy) || 0.001;
        const dirX = dx / len;
        const dirY = dy / len;
        shadowTailExtension = {
          x: pLast.x + dirX * shadowRadius,
          y: pLast.y + dirY * shadowRadius,
          uvY: accumulatedDistance + shadowRadius
        };
        
        pathNodes.push({
          x: pLast.x + dirX * totalWidth,
          y: pLast.y + dirY * totalWidth,
          nx: normals[pointsCount - 1].x,
          ny: normals[pointsCount - 1].y,
          uvY: accumulatedDistance + totalWidth
        });
      }

      const numNodes = pathNodes.length;
      for (let i = 0; i < numNodes; i++) {
        const node = pathNodes[i];
        const wx = node.x;
        const wy = node.y;
        const nx = node.nx;
        const ny = node.ny;
        const uvY = node.uvY;

        const pxLeft = wx + nx * totalWidth;
        const pyLeft = wy + ny * totalWidth;
        const pxRight = wx - nx * totalWidth;
        const pyRight = wy - ny * totalWidth;
        const zLiftT = pathIdx === 0 && accumulatedDistance > 0
          ? 1.0 - Math.min(1.0, Math.max(0.0, uvY / accumulatedDistance))
          : 0.0;
        const bodyZ = snakeZ + zLiftT * 0.08;

        bodyVerticesTemp.push(
          pxLeft, pyLeft, bodyZ,
          pxRight, pyRight, bodyZ
        );

        bodyUVsTemp.push(
          0.0, uvY,
          1.0, uvY
        );

        bodyColorsTemp.push(
          parsedColorObj.r, parsedColorObj.g, parsedColorObj.b,
          parsedColorObj.r, parsedColorObj.g, parsedColorObj.b
        );

        bodySnakeParamsTemp.push(
          totalWidth, accumulatedDistance,
          totalWidth, accumulatedDistance
        );

        // Shadow caps need their own extension because the shadow is wider than the body.
        const shadowCap = i === 0 ? shadowHeadExtension : (i === numNodes - 1 ? shadowTailExtension : null);
        const shadowWx = shadowCap?.x ?? wx;
        const shadowWy = shadowCap?.y ?? wy;
        const shadowUvY = shadowCap?.uvY ?? uvY;
        const shadowLeftX = shadowWx + nx * shadowRadius;
        const shadowLeftY = shadowWy + ny * shadowRadius;
        const shadowRightX = shadowWx - nx * shadowRadius;
        const shadowRightY = shadowWy - ny * shadowRadius;

        shadowVerticesTemp.push(
          shadowLeftX, shadowLeftY, shadowZ,
          shadowRightX, shadowRightY, shadowZ
        );
        shadowUVsTemp.push(
          0.0, shadowUvY,
          1.0, shadowUvY
        );
        shadowColorsTemp.push(0, 0, 0, 0, 0, 0);
        shadowSnakeParamsTemp.push(
          shadowRadius, accumulatedDistance,
          shadowRadius, accumulatedDistance
        );
      }

      for (let i = 0; i < numNodes - 1; i++) {
        const v0 = baseVIdx + i * 2;
        const v1 = baseVIdx + i * 2 + 1;
        const v2 = baseVIdx + (i + 1) * 2;
        const v3 = baseVIdx + (i + 1) * 2 + 1;

        bodyIndicesTemp.push(
          v0, v1, v2,
          v2, v1, v3
        );

        const sv0 = baseVIdxShadow + i * 2;
        const sv1 = baseVIdxShadow + i * 2 + 1;
        const sv2 = baseVIdxShadow + (i + 1) * 2;
        const sv3 = baseVIdxShadow + (i + 1) * 2 + 1;

        shadowIndicesTemp.push(
          sv0, sv1, sv2,
          sv2, sv1, sv3
        );
      }
    }

    // 5. Eyes & Pupils matrix preparation
    const snakeRadius = radius * gridSize;
    const head = p.body[0];
    let startHead = head;
    if (oldP && oldP.body) startHead = oldP.body[0] || head;
    if (Math.abs(head.x - startHead.x) > 50 || Math.abs(head.y - startHead.y) > 50) startHead = head;

    const hx = (startHead.x + (head.x - startHead.x) * progress) * gridSize + gridSize/2;
    const hy = -((startHead.y + (head.y - startHead.y) * progress) * gridSize + gridSize/2);

    const eyeRadius = snakeRadius * 0.35;
    const pupilRadius = eyeRadius * 0.5;
    const forwardOffset = snakeRadius * 0.45;
    const sideOffset = snakeRadius * 0.45;
    const zOffset = snakeZ + 0.1;

    const visAngle = -p.angle;
    const dirFx = Math.cos(visAngle);
    const dirFy = Math.sin(visAngle);
    const dirRx = Math.cos(visAngle + Math.PI/2);
    const dirRy = Math.sin(visAngle + Math.PI/2);

    const fogAmt = calcFogAmount(hx, hy);

    for (const side of [-1, 1]) {
      const ex = hx + dirFx * forwardOffset + dirRx * sideOffset * side;
      const ey = hy + dirFy * forwardOffset + dirRy * sideOffset * side;
      tempEyeList.push({ ex, ey, ez: zOffset, r: eyeRadius, color: fogAmt });

      const px = ex + dirFx * (eyeRadius * 0.3);
      const py = ey + dirFy * (eyeRadius * 0.3);
      tempPupilList.push({ px, py, pz: zOffset + 0.01, r: pupilRadius, color: fogAmt });
    }

    // 6. Nicknames Positioning
    let nicknameAlpha = 1.0;
    if ((p as any).spawn_protection_time && (p as any).spawn_protection_time > 0) {
      if ((p as any).spawn_protection_time < 2.0) {
        nicknameAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
      }
    }

    nicknames.push({
      id: playerId,
      nickname: p.nickname || "Игрок",
      x: hx,
      y: hy + snakeRadius + 4.5,
      z: 3.5,
      rotationX: cameraMode === "3D" ? pitchAngle : 0,
      opacity: nicknameAlpha
    });

    // 7. Particles spawning
    const isAccelerating = p.accelerating;
    if (isAccelerating && Math.random() < 0.35) {
      const tail = p.body[p.body.length - 1];
      const oldTailPlayer = lastState?.players[playerId];
      let startTail = tail;
      if (oldTailPlayer && oldTailPlayer.body && oldTailPlayer.body.length > 0) {
        startTail = oldTailPlayer.body[oldTailPlayer.body.length - 1] || tail;
      }
      if (Math.abs(tail.x - startTail.x) > 50 || Math.abs(tail.y - startTail.y) > 50) startTail = tail;

      const tx = (startTail.x + (tail.x - startTail.x) * progress) * gridSize + gridSize/2;
      const ty = -((startTail.y + (tail.y - startTail.y) * progress) * gridSize + gridSize/2);

      const tailAngle = p.angle + Math.PI;
      const angle = tailAngle + randomRange(-0.35, 0.35);
      const speed = (2.0 + Math.random() * 2.0) * gridSize * 0.001 * 40.0;
      
      const pColorStr = p.skin === 'zebra' ? '#ffffff' : (p.skin || '#22c55e');
      const pColor = parseColor(pColorStr);

      activeParticles.push({
        x: tx,
        y: ty,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: pColor,
        size: (0.15 + Math.random() * 0.25) * snakeRadius,
        life: 0.6 + Math.random() * 0.6,
      });
    }
  }

  // Eye / Pupil TypedArrays creation
  const eyeCount = tempEyeList.length;
  const eyeMatrices = new Float32Array(eyeCount * 16);
  const eyeColors = new Float32Array(eyeCount * 3);

  for (let i = 0; i < eyeCount; i++) {
    const e = tempEyeList[i];
    writeMatrix(eyeMatrices, i, e.ex, e.ey, e.ez, e.r);

    const fogAmt = e.color;
    const finalR = 1.0 + (FOG_R - 1.0) * fogAmt;
    const finalG = 1.0 + (FOG_G - 1.0) * fogAmt;
    const finalB = 1.0 + (FOG_B - 1.0) * fogAmt;

    const cIdx = i * 3;
    eyeColors[cIdx + 0] = finalR;
    eyeColors[cIdx + 1] = finalG;
    eyeColors[cIdx + 2] = finalB;
  }

  const pupilCount = tempPupilList.length;
  const pupilMatrices = new Float32Array(pupilCount * 16);
  const pupilColors = new Float32Array(pupilCount * 3);

  for (let i = 0; i < pupilCount; i++) {
    const p = tempPupilList[i];
    writeMatrix(pupilMatrices, i, p.px, p.py, p.pz, p.r);

    const fogAmt = p.color;
    const finalR = 0.0 + (FOG_R - 0.0) * fogAmt;
    const finalG = 0.0 + (FOG_G - 0.0) * fogAmt;
    const finalB = 0.0 + (FOG_B - 0.0) * fogAmt;

    const cIdx = i * 3;
    pupilColors[cIdx + 0] = finalR;
    pupilColors[cIdx + 1] = finalG;
    pupilColors[cIdx + 2] = finalB;
  }

  // 8. Particles updating
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const part = activeParticles[i];
    part.x += part.vx * dt * 60.0;
    part.y += part.vy * dt * 60.0;
    part.life -= dt;
    if (part.life <= 0) {
      activeParticles.splice(i, 1);
    }
  }

  const particleMatrices = new Float32Array(activeParticles.length * 16);
  const particleColors = new Float32Array(activeParticles.length * 3);

  for (let i = 0; i < activeParticles.length; i++) {
    const part = activeParticles[i];
    writeMatrix(particleMatrices, i, part.x, part.y, 0.9, part.size);

    const pr = ((part.color >> 16) & 255) / 255;
    const pg = ((part.color >> 8) & 255) / 255;
    const pb = (part.color & 255) / 255;

    const fogAmt = calcFogAmount(part.x, part.y);
    const finalR = pr + (FOG_R - pr) * fogAmt;
    const finalG = pg + (FOG_G - pg) * fogAmt;
    const finalB = pb + (FOG_B - pb) * fogAmt;

    const cIdx = i * 3;
    particleColors[cIdx + 0] = finalR;
    particleColors[cIdx + 1] = finalG;
    particleColors[cIdx + 2] = finalB;
  }

  // 9. Convert snake body arrays to typed arrays
  const bodyVertices = new Float32Array(bodyVerticesTemp);
  const bodyUVs = new Float32Array(bodyUVsTemp);
  const bodyColors = new Float32Array(bodyColorsTemp);
  const bodySnakeParams = new Float32Array(bodySnakeParamsTemp);
  const bodyIndices = new Uint32Array(bodyIndicesTemp);

  const shadowVertices = new Float32Array(shadowVerticesTemp);
  const shadowUVs = new Float32Array(shadowUVsTemp);
  const shadowColors = new Float32Array(shadowColorsTemp);
  const shadowSnakeParams = new Float32Array(shadowSnakeParamsTemp);
  const shadowIndices = new Uint32Array(shadowIndicesTemp);

  // 10. Leaderboard calculations
  const board = Object.entries(state.players)
    .map(([playerId, p]) => ({
      id: playerId,
      nickname: p.nickname || "Игрок",
      score: p.score || 0,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      isMe: playerId === myId,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const killEventsToSend = [...accumulatedKillEvents];
  accumulatedKillEvents = [];

  // Send everything back!
  ctx.postMessage({
    type: "FRAME_DATA",
    bodyVertices,
    bodyUVs,
    bodyColors,
    bodySnakeParams,
    bodyIndices,
    shadowVertices,
    shadowUVs,
    shadowColors,
    shadowSnakeParams,
    shadowIndices,
    eyeMatrices,
    eyeColors,
    eyeCount,
    pupilMatrices,
    pupilColors,
    pupilCount,
    particleMatrices,
    particleColors,
    particleCount: activeParticles.length,
    foodMatrices,
    foodColors,
    foodShadowMatrices,
    foodCount,
    portalDiskMatrices,
    portalDiskColors,
    portalRingMatrices,
    portalRingColors,
    portalCount,
    blackHoleCoreMatrices,
    blackHoleRingMatrices,
    blackHoleGravityMatrices,
    blackHoleCount,
    camX,
    camY,
    camAngle,
    fogRadiusWorld,
    nicknames,
    activePlayers,
    gameState: state,
    leaderboard: board,
    kill_events: killEventsToSend
  }, [
    bodyVertices.buffer,
    bodyUVs.buffer,
    bodyColors.buffer,
    bodySnakeParams.buffer,
    bodyIndices.buffer,
    shadowVertices.buffer,
    shadowUVs.buffer,
    shadowColors.buffer,
    shadowSnakeParams.buffer,
    shadowIndices.buffer,
    eyeMatrices.buffer,
    eyeColors.buffer,
    pupilMatrices.buffer,
    pupilColors.buffer,
    particleMatrices.buffer,
    particleColors.buffer,
    foodMatrices.buffer,
    foodColors.buffer,
    foodShadowMatrices.buffer,
    portalDiskMatrices.buffer,
    portalDiskColors.buffer,
    portalRingMatrices.buffer,
    portalRingColors.buffer,
    blackHoleCoreMatrices.buffer,
    blackHoleRingMatrices.buffer,
    blackHoleGravityMatrices.buffer
  ]);
}

function connect(url: string) {
  if (isCleaningUp) return;

  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.onopen = () => {
    reconnectAttempt = 0;
    ctx.postMessage({ type: "STATUS", status: "connected", msg: "" });

    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(`PING:${Math.floor(performance.now())}`);
      }
    }, 2000);
  };

  socket.onclose = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    ctx.postMessage({ type: "DISCONNECT" });

    if (isCleaningUp) return;

    reconnectAttempt += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 30000);
    ctx.postMessage({ 
      type: "STATUS", 
      status: "reconnecting", 
      msgKey: "status.reconnecting",
      msgParams: { seconds: Math.ceil(delay / 1000) }
    });

    reconnectTimer = setTimeout(() => {
      connect(url);
    }, delay);
  };

  socket.onerror = () => {
    // onclose will handle this
  };

  socket.onmessage = async (event) => {
    if (typeof event.data === "string") {
      if (event.data.startsWith("PONG:")) {
        const timestamp = parseFloat(event.data.substring(5));
        const latency = performance.now() - timestamp;
        ctx.postMessage({ type: "PING", latency });
      }
      return;
    }

    try {
      const decompressedBuffer = await decompress(new Uint8Array(event.data));
      const parsedState = decode(new Uint8Array(decompressedBuffer)) as any;
      if (parsedState.type === "SERVER_RESTART") {
        ctx.postMessage({
          type: "STATUS",
          status: "reconnecting",
          msg: parsedState.message || undefined,
          msgKey: parsedState.message ? undefined : "status.serverRestart"
        });
        socket?.close(1000, "Server Restart");
        return;
      }

      if (parsedState.your_id) {
        myId = parsedState.your_id;
        ctx.postMessage({ type: "YOUR_ID", your_id: myId });
      }

      const mapW = parsedState.server_world?.width ?? 100;
      const mapH = parsedState.server_world?.height ?? 100;

      if (parsedState.type === "FULL" || !parsedState.type) {
        const players: Record<string, Player> = {};
        if (parsedState.players) {
          for (const [pid, player] of Object.entries(parsedState.players)) {
            const netPlayer = player as any;
            players[pid] = {
              ...netPlayer,
              body: parsePoints(netPlayer.body),
            };
          }
        }
        const initialFoods = (parsedState.foods || [])
          .filter((f: any) => f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
          .map((f: Food) => ({ ...f }));
        
        foodMap.clear();
        for (let i = 0; i < initialFoods.length; i++) {
          const f = initialFoods[i];
          foodMap.set(f.id, f);
        }

        lastGameState = gameState;
        gameState = {
          server_tick_rate: parsedState.server_tick_rate,
          server_world: parsedState.server_world,
          server_simulation: parsedState.server_simulation,
          server_snake: parsedState.server_snake,
          server_visual: parsedState.server_visual,
          server_food: parsedState.server_food,
          players,
          foods: initialFoods,
          portals: parsedState.portals,
          black_holes: parsedState.black_holes
        };
      } else if (parsedState.type === "DELTA") {
        if (!gameState) return;

        const currentPlayers = gameState.players || {};
        const nextPlayers: Record<string, Player> = {};

        for (const [pid, pData] of Object.entries(parsedState.players as Record<string, any>)) {
          const oldPlayer = currentPlayers[pid];
          const defaultPlayer = {
            body: [] as { x: number; y: number }[],
            angle: 0,
            score: 0,
            kills: 0,
            deaths: 0,
            nickname: "",
            skin: "default"
          };
          const { body, new_heads, length, ...otherProps } = pData;
          let newBody: { x: number; y: number }[] = [];

          if (body) {
            newBody = parsePoints(body);
          } else if (oldPlayer && oldPlayer.body) {
            const addedHeads = parsePoints(new_heads);
            newBody = [...addedHeads, ...oldPlayer.body];
            const targetLen = length ?? oldPlayer.body.length;
            if (newBody.length > targetLen) {
              newBody = newBody.slice(0, targetLen);
            }
          }

          nextPlayers[pid] = {
            ...defaultPlayer,
            ...oldPlayer,
            ...otherProps,
            body: newBody,
          };
        }

        for (const pid in currentPlayers) {
          if (!nextPlayers[pid] && !parsedState.players[pid]) {
            nextPlayers[pid] = currentPlayers[pid];
          }
        }

        if (parsedState.eaten_foods) {
          for (let i = 0; i < parsedState.eaten_foods.length; i++) {
            foodMap.delete(parsedState.eaten_foods[i]);
          }
        }

        const newFoodsFiltered: Food[] = [];
        if (parsedState.new_foods) {
          for (let i = 0; i < parsedState.new_foods.length; i++) {
            const nf = parsedState.new_foods[i] as Food;
            if (nf.x >= 0 && nf.x < mapW && nf.y >= 0 && nf.y < mapH) {
              const nextFood = { ...nf };
              newFoodsFiltered.push(nextFood);
              foodMap.set(nextFood.id, nextFood);
            }
          }
        }

        const eatenSet = new Set(parsedState.eaten_foods || []);
        const movedFoodPositions = new Map<number, { x: number; y: number }>();
        const movedFoods = parsedState.moved_foods;
        if (movedFoods && movedFoods.length > 0) {
          for (let i = 0; i < movedFoods.length; i++) {
            const mf = movedFoods[i];
            if (typeof mf.id === "number" && typeof mf.x === "number" && typeof mf.y === "number" && !isNaN(mf.x) && !isNaN(mf.y)) {
              movedFoodPositions.set(mf.id, { x: mf.x, y: mf.y });
            }
          }
        }

        const nextFoods = gameState.foods
          .filter((f) => !eatenSet.has(f.id) && f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
          .map((f) => {
            const moved = movedFoodPositions.get(f.id);
            const nextFood = moved ? { ...f, x: moved.x, y: moved.y } : f;
            foodMap.set(nextFood.id, nextFood);
            return nextFood;
          })
          .concat(newFoodsFiltered);

        lastGameState = gameState;
        gameState = {
          server_tick_rate: parsedState.server_tick_rate ?? gameState.server_tick_rate,
          server_world: parsedState.server_world ?? gameState.server_world,
          server_simulation: parsedState.server_simulation ?? gameState.server_simulation,
          server_snake: parsedState.server_snake ?? gameState.server_snake,
          server_visual: parsedState.server_visual ?? gameState.server_visual,
          server_food: parsedState.server_food ?? gameState.server_food,
          players: nextPlayers,
          foods: nextFoods,
          portals: parsedState.portals ?? gameState.portals,
          black_holes: parsedState.black_holes ?? gameState.black_holes
        };
      }

      if (parsedState.kill_events) {
        accumulatedKillEvents.push(...parsedState.kill_events);
      }

      if (gameState) {
        stateQueue.push({
          time: performance.now(),
          state: gameState,
        });
        if (stateQueue.length > 20) {
          stateQueue.shift();
        }
      }

    } catch (err) {
      console.error("Worker decompression or parsing error:", err);
    }
  };
}

function cleanup() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "CONNECT") {
    isCleaningUp = false;
    connect(msg.url);
  } else if (msg.type === "SEND") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg.data);
    }
  } else if (msg.type === "CLOSE") {
    isCleaningUp = true;
    cleanup();
  } else if (msg.type === "REQUEST_FRAME") {
    handleRequestFrame(msg);
  }
};
