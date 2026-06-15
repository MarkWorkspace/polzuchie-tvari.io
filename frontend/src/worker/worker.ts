// ROLE: Точка входа воркера, onmessage-роутер. Не содержит вычислений.

import type { GameState } from "../types/game";
import { WebSocketClient } from "./WebSocketClient";
import { StateInterpolator } from "./StateInterpolation";
import { CameraPredictor } from "./CameraPredictor";
import { EyeComputer } from "./EyeComputer";
import { ParticleComputer } from "./ParticleComputer";
import { decodeDeltaState, decodeFullState } from "./DeltaDecoder";
import { computeFrame } from "./FrameComputer";
import type { GeometryBuffers } from "./MeshBuilder";
import { GrowableFloat32Array, GrowableUint32Array } from "./shared/GrowableArray";

const ctx: Worker = self as any;

let client: WebSocketClient | null = null;
const interpolator = new StateInterpolator();
const camera = new CameraPredictor();
const particles = new ParticleComputer();
const eyes = new EyeComputer();

let currentGameState: GameState | null = null;

let myId = "";
let accumulatedKillEvents: any[] = [];

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

ctx.onmessage = (e: MessageEvent) => {
  try {
    const msg = e.data;
    if (msg.type === "CONNECT") {
      _handleConnect(msg.url);
    } else if (msg.type === "SEND") {
      client?.send(msg.data);
    } else if (msg.type === "CLOSE") {
      _handleClose();
    } else if (msg.type === "REQUEST_FRAME") {
      _handleRequestFrame(msg);
    }
  } catch (error) {
    console.error("[Worker] Unhandled error in onmessage:", error);
  }
};

function _handleConnect(url: string) {
  _handleClose();
  client = new WebSocketClient(url);
  
  client.onStatus((status, details) => ctx.postMessage({ type: "STATUS", status, ...details }));
  client.onDisconnect(() => ctx.postMessage({ type: "DISCONNECT" }));
  client.onPing((latency) => ctx.postMessage({ type: "PING", latency }));
  client.onYourId((id) => {
    myId = id;
    ctx.postMessage({ type: "YOUR_ID", your_id: id });
  });

  client.onMessage((parsedState) => {
    try {
      const mapW = parsedState.server_world?.width ?? (currentGameState?.server_world?.width ?? 100);
      const mapH = parsedState.server_world?.height ?? (currentGameState?.server_world?.height ?? 100);

      if (parsedState.type === "FULL" || !parsedState.type) {
        currentGameState = decodeFullState(parsedState, mapW, mapH);
      } else if (parsedState.type === "DELTA" && currentGameState) {
        currentGameState = decodeDeltaState(parsedState, currentGameState, mapW, mapH);
      }

      if (parsedState.kill_events) {
        accumulatedKillEvents.push(...parsedState.kill_events);
      }

      if (currentGameState) {
        interpolator.pushState(currentGameState, performance.now());
      }
    } catch (error) {
      console.error("[Worker] Error decoding state:", error);
    }
  });

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

function _handleRequestFrame(msg: any) {
  const { dt, localInput, gridSize } = msg;
  const tickRate = currentGameState?.server_simulation?.tick_rate ?? 30;

  const interpolated = interpolator.interpolate(dt, tickRate);
  if (!interpolated) {
    ctx.postMessage({ type: "FRAME_DATA", eyeCount: 0, pupilCount: 0, particleCount: 0, foodCount: 0, portalCount: 0, blackHoleCount: 0 });
    return;
  }

  const { state, lastState, progress } = interpolated;
  try {
    const frame = computeFrame(
      dt, localInput, gridSize, state, lastState, progress, myId, camera, particles, eyes, accumulatedKillEvents,
      bodyBufs, tempFoodMatrices, tempFoodColors
    );

    accumulatedKillEvents = [];
    ctx.postMessage(frame.payload, frame.transferables);
  } catch (error) {
    console.error("[Worker] Frame computation error:", error);
    ctx.postMessage({ type: "FRAME_DATA", eyeCount: 0, pupilCount: 0, particleCount: 0, foodCount: 0, portalCount: 0, blackHoleCount: 0 });
  }
}
