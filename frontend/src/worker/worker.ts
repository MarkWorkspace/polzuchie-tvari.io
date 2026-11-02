// ROLE: Точка входа воркера, onmessage-роутер. Не содержит вычислений.

import type { GameState, KillEvent } from "../types/game";
import { CameraPredictor } from "./CameraPredictor";
import { decodeDeltaState, decodeFullState } from "./DeltaDecoder";
import { EyeComputer } from "./EyeComputer";
import { computeFrame } from "./FrameComputer";
import type { GeometryBuffers } from "./MeshBuilder";
import { ParticleComputer } from "./ParticleComputer";
import { StateInterpolator } from "./StateInterpolation";
import { GrowableFloat32Array, GrowableUint32Array } from "./shared/GrowableArray";
import type {
  FrameRequest,
  FrameUnavailableMessage,
  MainToWorker,
  WorkerConnectionStatus,
  WorkerToMain,
} from "./shared/WorkerProtocol";
import { WebSocketClient } from "./WebSocketClient";

interface WorkerScope {
  onmessage: ((event: MessageEvent<MainToWorker>) => void) | null;
  postMessage(message: WorkerToMain, transfer?: Transferable[]): void;
}

const ctx = self as unknown as WorkerScope;

let client: WebSocketClient | null = null;
const interpolator = new StateInterpolator();
const camera = new CameraPredictor();
const particles = new ParticleComputer();
const eyes = new EyeComputer();

let currentGameState: GameState | null = null;

let myId = "";
let accumulatedKillEvents: KillEvent[] = [];

/**
 * A request-scoped "no frame yet" reply. It carries no camera/game state, so
 * the main thread only clears its pending request instead of applying it.
 */
export function buildFrameUnavailable(requestId?: number): FrameUnavailableMessage {
  return requestId === undefined
    ? { type: "FRAME_UNAVAILABLE" }
    : { type: "FRAME_UNAVAILABLE", requestId };
}

// Reusable geometry buffers to avoid garbage collection
const bodyBufs: GeometryBuffers = {
  vertices: new GrowableFloat32Array(),
  uvs: new GrowableFloat32Array(),
  colors: new GrowableFloat32Array(),
  params: new GrowableFloat32Array(),
  indices: new GrowableUint32Array(),
};

const tempFoodMatrices = new Float32Array(5000 * 16);
const tempFoodColors = new Float32Array(5000 * 3);
const tempFoodImageIndices = new Int32Array(5000);

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  try {
    const msg = e.data;
    if (msg.type === "CONNECT") {
      _handleConnect(msg.url);
    } else if (msg.type === "SEND") {
      // RESYNC is connection control, never a gameplay input: only
      // WebSocketClient.requestResync may send it.
      if (msg.data !== "RESYNC") client?.send(msg.data);
    } else if (msg.type === "CLOSE") {
      _handleClose();
    } else if (msg.type === "REQUEST_FRAME") {
      _handleRequestFrame(msg);
    }
  } catch (error) {
    console.error("[Worker] Unhandled error in onmessage:", error);
  }
};

function _handleWebSocketMessage(parsedState: any) {
  try {
    const mapW = parsedState.server_world?.width ?? currentGameState?.server_world?.width ?? 100;
    const mapH = parsedState.server_world?.height ?? currentGameState?.server_world?.height ?? 100;

    const isFull = parsedState.type === "FULL" || !parsedState.type;
    if (!isFull && parsedState.type !== "DELTA") return;

    let nextState: GameState;
    if (isFull) {
      nextState = decodeFullState(parsedState, mapW, mapH);
    } else {
      // The sequencer only forwards a DELTA after a FULL, but keep the guard
      // so a malformed message cannot decode against a missing base state.
      if (!currentGameState) return;
      nextState = decodeDeltaState(parsedState, currentGameState, mapW, mapH);
    }

    if (parsedState.kill_events) {
      accumulatedKillEvents.push(...parsedState.kill_events);
    }

    // Commit only after the whole frame decoded: a throw leaves the previous
    // state, myId and the interpolator untouched.
    currentGameState = nextState;
    interpolator.pushState(currentGameState, performance.now());
  } catch (error) {
    console.error("[Worker] Error decoding state:", error);
    // A partially applied delta chain cannot be repaired locally; ask for FULL
    // and drop the local seq until that FULL arrives.
    client?.invalidateSequence();
    client?.requestResync();
  }
}

function _handleConnect(url: string) {
  _handleClose();
  client = new WebSocketClient(url);

  client.onStatus((status, details) => {
    const message: WorkerToMain = {
      type: "STATUS",
      status: status as WorkerConnectionStatus,
      ...(details ?? {}),
    };
    ctx.postMessage(message);
  });
  client.onDisconnect(() => ctx.postMessage({ type: "DISCONNECT" }));
  client.onPing((latency) => ctx.postMessage({ type: "PING", latency }));
  client.onYourId((id) => {
    myId = id;
    ctx.postMessage({ type: "YOUR_ID", your_id: id });
  });

  client.onMessage(_handleWebSocketMessage);

  client.connect();
}

function _handleClose() {
  client?.disconnect();
  client = null;
  interpolator.clear();
  camera.reset();
  particles.clear();
  eyes.reset();
  currentGameState = null;

  myId = "";
  accumulatedKillEvents = [];
}

function _requestIdOf(msg: FrameRequest): number | undefined {
  return typeof msg.requestId === "number" && Number.isFinite(msg.requestId)
    ? msg.requestId
    : undefined;
}

function _handleRequestFrame(msg: FrameRequest) {
  const requestId = _requestIdOf(msg);
  const { dt, localInput, gridSize, isSpectator, showAllInMainCopy, spectatorCam } = msg;
  const tickRate = currentGameState?.server_simulation?.tick_rate ?? 30;

  const interpolated = interpolator.interpolate(dt, tickRate);
  if (!interpolated) {
    ctx.postMessage(buildFrameUnavailable(requestId));
    return;
  }

  const { state, lastState, progress } = interpolated;
  try {
    const frame = computeFrame({
      dt,
      localInput,
      gridSize,
      state,
      lastState,
      progress,
      myId,
      isSpectator,
      showAllInMainCopy,
      spectatorCam,
      camera,
      particles,
      eyes,
      accumulatedKillEvents,
      bodyBufs,
      tempFoodMatrices,
      tempFoodColors,
      tempFoodImageIndices,
    });

    accumulatedKillEvents = [];
    if (requestId !== undefined) frame.payload.requestId = requestId;
    ctx.postMessage(frame.payload, frame.transferables);
  } catch (error) {
    console.error("[Worker] Frame computation error:", error);
    ctx.postMessage(buildFrameUnavailable(requestId));
  }
}
