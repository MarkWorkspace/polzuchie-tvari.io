// ROLE: WebSocket-интерфейс к воркеру и player-session bootstrap. Не бизнес-логика.

import { gridSize } from "./Config";

export type NetworkStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface FrameInput {
  turn: number;
  accelerating: boolean;
  mode: string;
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

  private onStatusChange?: (
    status: NetworkStatus,
    msg?: string,
    msgKey?: string,
    msgParams?: any,
  ) => void;
  private onPing?: (latency: number) => void;
  private onYourId?: (id: string) => void;
  private onFrameData?: (msg: any) => void;
  private onDisconnect?: () => void;

  constructor() {
    clearLegacyClientId(defaultStorage());
  }

  /**
   * Player connections first obtain/reuse the HttpOnly session cookie.
   * A spectator never touches `/session` and always gets a fresh server UUID.
   */
  public async connect(nickname: string, skin: string, role: string = "player"): Promise<void> {
    this.close();
    const generation = this.connectGeneration;

    if (role === "player") {
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
      this.spawnWorker(nickname, skin, role);
    } catch (error) {
      console.warn("[NetworkManager] Failed to start the network worker", error);
      this.close();
      this.onStatusChange?.("disconnected", undefined, "session.startFailed");
    }
  }

  public send(msg: string): void {
    this.worker?.postMessage({ type: "SEND", data: msg });
  }

  public requestFrame(
    dt: number,
    myId: string,
    input: any,
    showAllInMainCopy: boolean = false,
    spectatorCam?: { x: number; y: number },
  ): void {
    if (!this.worker || this.isWaitingForFrame) return;

    this.isWaitingForFrame = true;
    this.frameTimeoutId = window.setTimeout(() => {
      this.isWaitingForFrame = false;
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
      sentTime: performance.now(),
    });
  }

  public close(): void {
    this.connectGeneration++;
    if (this.worker) {
      this.worker.postMessage({ type: "CLOSE" });
      this.worker.terminate();
      this.worker = null;
    }
    this.isWaitingForFrame = false;
    if (this.frameTimeoutId !== null) {
      window.clearTimeout(this.frameTimeoutId);
      this.frameTimeoutId = null;
    }
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
    onFrameData?: (msg: any) => void;
    onDisconnect?: () => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onPing = callbacks.onPing;
    this.onYourId = callbacks.onYourId;
    this.onFrameData = callbacks.onFrameData;
    this.onDisconnect = callbacks.onDisconnect;
  }

  public getWaitingForFrame(): boolean {
    return this.isWaitingForFrame;
  }

  public clearWaitingForFrame(): void {
    this.isWaitingForFrame = false;
  }

  private spawnWorker(nickname: string, skin: string, role: string): void {
    // Initialize worker with relative module URL standard in Vite
    this.worker = new Worker(new URL("../worker/worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = this.handleWorkerMessage;

    const wsUrl = buildGameWsUrl(nickname, skin, role, window.location, import.meta.env.DEV);
    this.worker.postMessage({ type: "CONNECT", url: wsUrl });
  }

  private handleWorkerMessage = (event: MessageEvent): void => {
    const msg = event.data;
    if (msg.type === "STATUS") {
      this.onStatusChange?.(msg.status, msg.msg, msg.msgKey, msg.msgParams);
    } else if (msg.type === "DISCONNECT") {
      this.onDisconnect?.();
    } else if (msg.type === "PING") {
      this.onPing?.(msg.latency);
    } else if (msg.type === "YOUR_ID") {
      this.onYourId?.(msg.your_id);
    } else if (msg.type === "FRAME_DATA") {
      this.isWaitingForFrame = false;
      if (this.frameTimeoutId !== null) {
        window.clearTimeout(this.frameTimeoutId);
        this.frameTimeoutId = null;
      }
      this.onFrameData?.(msg);
    }
  };
}
