// ROLE: WebSocket-интерфейс к воркеру и player-session bootstrap. Не бизнес-логика.

import type {
  FrameDataMessage,
  FrameInput,
  FrameRequest,
  MainToWorker,
  SpectatorCam,
  WorkerConnectionStatus,
  WorkerToMain,
} from "../worker/shared/WorkerProtocol";
import { reconnectDelayMs } from "../worker/WebSocketClient";
import { gridSize } from "./Config";

export type NetworkStatus = WorkerConnectionStatus;

export type { FrameInput } from "../worker/shared/WorkerProtocol";

/** A worker is presumed wedged after this many consecutive 100 ms frame timeouts. */
export const FRAME_TIMEOUT_STALL_THRESHOLD = 30;
export const MAX_WORKER_RESTARTS = 3;

export type WorkerFailureReason = "worker" | "stall";

export interface ConnectArgs {
  nickname: string;
  skin: string;
  role: string;
}

export const LEGACY_CLIENT_ID_STORAGE_KEY = "snake_client_id";

export interface SessionLocation {
  protocol: string;
  hostname: string;
}

export interface GameWsLocation extends SessionLocation {
  port: string;
}

export type PlayerSessionResult =
  | { ok: true }
  | { ok: false; status: number | null; error: string };

/**
 * A frame response belongs to the in-flight request when its `requestId`
 * matches. Responses without an id come from an older worker and are accepted
 * for backward compatibility; once the main-side timeout fired there is no
 * pending id, so a late numeric-id response is stale and must be dropped.
 */
export function isCurrentFrameResponse(
  msg: { requestId?: unknown } | null | undefined,
  pendingRequestId: number | null,
): boolean {
  const requestId = msg?.requestId;
  if (typeof requestId !== "number" || !Number.isFinite(requestId)) return true;
  return pendingRequestId !== null && requestId === pendingRequestId;
}

/**
 * Dev serves Vite on :5173 and the backend on :8000, so the session cookie must
 * be issued by the backend origin. Production serves the API on the same origin
 * under the nginx `/ws` prefix.
 */
export function buildSessionUrl(location: SessionLocation, isDev: boolean): string {
  if (!isDev) return "/ws/session";
  const protocol = location.protocol || "http:";
  const host = location.hostname || "127.0.0.1";
  return `${protocol}//${host}:8000/session`;
}

/** Build the game WS URL. Identity comes from the session cookie, never the URL. */
export function buildGameWsUrl(
  nickname: string,
  skin: string,
  role: string,
  location: GameWsLocation,
  isDev: boolean,
): string {
  const host = location.hostname || "127.0.0.1";
  const protocol = location.protocol === "https:" ? "wss://" : "ws://";
  const port = isDev ? "8000" : location.port || "";
  const wsPort = port ? `:${port}` : "";
  const trimmed = nickname.trim() || "Snake";
  return `${protocol}${host}${wsPort}/ws/?nickname=${encodeURIComponent(trimmed)}&skin=${encodeURIComponent(skin)}&role=${encodeURIComponent(role)}`;
}

/** POST /session so the server can set the HttpOnly player cookie. */
export async function ensurePlayerSession(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PlayerSessionResult> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Drop the pre-cookie identity key; session identity is now server-side only. */
export function clearLegacyClientId(storage: Pick<Storage, "removeItem"> | null): void {
  try {
    storage?.removeItem(LEGACY_CLIENT_ID_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private/locked-down contexts.
  }
}

function defaultStorage(): Pick<Storage, "removeItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export class NetworkManager {
  private worker: Worker | null = null;
  private isWaitingForFrame = false;
  private frameTimeoutId: number | null = null;
  private connectGeneration = 0;
  /** Monotonic across reconnects so a late reply can never match a new request. */
  private requestSequence = 0;
  private pendingRequestId: number | null = null;

  private lastConnectArgs: ConnectArgs | null = null;
  private workerRestartAttempt = 0;
  private restartTimeoutId: number | null = null;
  private consecutiveFrameTimeouts = 0;

  private onStatusChange?: (
    status: NetworkStatus,
    msg?: string,
    msgKey?: string,
    msgParams?: any,
  ) => void;
  private onPing?: (latency: number) => void;
  private onYourId?: (id: string) => void;
  private onFrameData?: (msg: FrameDataMessage) => void;
  private onDisconnect?: () => void;
  private onWorkerRestart?: () => void;
  private onFatalError?: (reason: WorkerFailureReason) => void;

  constructor() {
    clearLegacyClientId(defaultStorage());
  }

  /**
   * Player connections first obtain/reuse the HttpOnly session cookie.
   * A spectator never touches `/session` and always gets a fresh server UUID.
   */
  public async connect(nickname: string, skin: string, role: string = "player"): Promise<void> {
    await this.startConnection({ nickname, skin, role }, false);
  }

  private async startConnection(args: ConnectArgs, isRestart: boolean): Promise<void> {
    this.lastConnectArgs = { ...args };
    this.connectGeneration++;
    this.cancelRestartTimer();
    this.stopWorker();
    if (!isRestart) this.workerRestartAttempt = 0;

    const generation = this.connectGeneration;

    if (args.role === "player") {
      const result = await ensurePlayerSession(
        buildSessionUrl(window.location, import.meta.env.DEV),
      );
      if (generation !== this.connectGeneration) return;
      if (!result.ok) {
        console.warn(
          "[NetworkManager] Player session request failed",
          result.status ?? result.error,
        );
        this.onStatusChange?.("disconnected", undefined, "session.startFailed");
        return;
      }
    }

    try {
      this.spawnWorker(args.nickname, args.skin, args.role);
    } catch (error) {
      console.warn("[NetworkManager] Failed to start the network worker", error);
      this.close();
      this.onStatusChange?.("disconnected", undefined, "session.startFailed");
    }
  }

  public send(msg: string): void {
    const message: MainToWorker = { type: "SEND", data: msg };
    this.worker?.postMessage(message);
  }

  public requestFrame(
    dt: number,
    myId: string,
    input: FrameInput,
    showAllInMainCopy: boolean = false,
    spectatorCam?: SpectatorCam,
  ): void {
    if (!this.worker || this.isWaitingForFrame) return;

    const requestId = ++this.requestSequence;
    this.isWaitingForFrame = true;
    this.pendingRequestId = requestId;
    this.frameTimeoutId = window.setTimeout(() => {
      // Main-side fallback: allow the next request. A late worker reply keeps
      // the old id and is ignored by isCurrentFrameResponse.
      this.isWaitingForFrame = false;
      this.pendingRequestId = null;
      this.frameTimeoutId = null;
      this.consecutiveFrameTimeouts++;
      if (this.consecutiveFrameTimeouts >= FRAME_TIMEOUT_STALL_THRESHOLD) {
        this.consecutiveFrameTimeouts = 0;
        this.handleWorkerFailure("stall");
      }
    }, 100);

    this.worker.postMessage({
      type: "REQUEST_FRAME",
      dt,
      myId,
      isSpectator: myId === "spectator_id",
      showAllInMainCopy,
      spectatorCam,
      gridSize,
      localInput: input,
      requestId,
    } satisfies FrameRequest);
  }

  /** Manual teardown (destroy/takeover): no watchdog restart may survive it. */
  public close(): void {
    this.connectGeneration++;
    this.lastConnectArgs = null;
    this.workerRestartAttempt = 0;
    this.cancelRestartTimer();
    this.stopWorker();
  }

  public setCallbacks(callbacks: {
    onStatusChange?: (
      status: NetworkStatus,
      msg?: string,
      msgKey?: string,
      msgParams?: any,
    ) => void;
    onPing?: (latency: number) => void;
    onYourId?: (id: string) => void;
    onFrameData?: (msg: FrameDataMessage) => void;
    onDisconnect?: () => void;
    onWorkerRestart?: () => void;
    onFatalError?: (reason: WorkerFailureReason) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onPing = callbacks.onPing;
    this.onYourId = callbacks.onYourId;
    this.onFrameData = callbacks.onFrameData;
    this.onDisconnect = callbacks.onDisconnect;
    this.onWorkerRestart = callbacks.onWorkerRestart;
    this.onFatalError = callbacks.onFatalError;
  }

  public getWaitingForFrame(): boolean {
    return this.isWaitingForFrame;
  }

  public clearWaitingForFrame(): void {
    this.resolvePendingFrame();
  }

  /** Drop the in-flight request so its late reply cannot be applied. */
  private resolvePendingFrame(): void {
    this.isWaitingForFrame = false;
    this.pendingRequestId = null;
    this.consecutiveFrameTimeouts = 0;
    if (this.frameTimeoutId !== null) {
      window.clearTimeout(this.frameTimeoutId);
      this.frameTimeoutId = null;
    }
  }

  private cancelRestartTimer(): void {
    if (this.restartTimeoutId !== null) {
      window.clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }
  }

  /** Terminate the current worker without touching the restart budget. */
  private stopWorker(): void {
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      try {
        const message: MainToWorker = { type: "CLOSE" };
        worker.postMessage(message);
      } catch {
        // The worker may already be dead; terminate still releases it.
      }
      worker.terminate();
    }
    this.resolvePendingFrame();
  }

  /**
   * A broken worker is replaced with backoff. The initial spawn plus three
   * restarts exhaust the budget; further failures are fatal so a crash loop
   * cannot spin forever and the UI shows the blocking error overlay.
   */
  private handleWorkerFailure(reason: WorkerFailureReason): void {
    this.connectGeneration++;
    this.cancelRestartTimer();
    this.stopWorker();
    this.workerRestartAttempt++;

    if (this.workerRestartAttempt > MAX_WORKER_RESTARTS) {
      this.lastConnectArgs = null;
      this.onStatusChange?.("disconnected", undefined, "error.workerCrashed");
      this.onFatalError?.(reason);
      return;
    }

    this.onWorkerRestart?.();
    this.onStatusChange?.("reconnecting", undefined, "status.workerRestart", {
      attempt: this.workerRestartAttempt,
    });

    const args = this.lastConnectArgs;
    if (!args) return;
    const delay = reconnectDelayMs(this.workerRestartAttempt);
    this.restartTimeoutId = window.setTimeout(() => {
      this.restartTimeoutId = null;
      void this.startConnection(args, true);
    }, delay);
  }

  private spawnWorker(nickname: string, skin: string, role: string): void {
    // Initialize worker with relative module URL standard in Vite
    const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker = worker;
    worker.onmessage = this.handleWorkerMessage;
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      console.warn("[NetworkManager] Worker crashed", event.message || "unknown error");
      this.handleWorkerFailure("worker");
    };
    worker.onmessageerror = () => {
      if (this.worker !== worker) return;
      console.warn("[NetworkManager] Worker message could not be deserialized");
      this.handleWorkerFailure("worker");
    };

    const wsUrl = buildGameWsUrl(nickname, skin, role, window.location, import.meta.env.DEV);
    const message: MainToWorker = { type: "CONNECT", url: wsUrl };
    worker.postMessage(message);
  }

  private handleWorkerMessage = (event: MessageEvent<WorkerToMain>): void => {
    const msg = event.data;
    if (msg.type === "STATUS") {
      this.onStatusChange?.(msg.status, msg.msg, msg.msgKey, msg.msgParams);
    } else if (msg.type === "DISCONNECT") {
      this.onDisconnect?.();
    } else if (msg.type === "PING") {
      this.onPing?.(msg.latency);
    } else if (msg.type === "YOUR_ID") {
      this.onYourId?.(msg.your_id);
    } else if (msg.type === "FRAME_DATA" || msg.type === "FRAME_UNAVAILABLE") {
      if (!isCurrentFrameResponse(msg, this.pendingRequestId)) return;
      this.resolvePendingFrame();
      // Unavailable frames keep the previous latestFrame on screen; they must
      // never reach onFrameData because they carry no camX/camY/gameState.
      if (msg.type === "FRAME_DATA") this.onFrameData?.(msg);
    }
  };
}
