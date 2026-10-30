// ROLE: WebSocket-соединение, реконнект, ping/pong. Не бизнес-логика.

import { decompress } from "./DeltaDecoder";
import { decodeGameStateFrame } from "./shared/ProtoFrameDecoder";

const MAX_RECONNECT_DELAY_MS = 30_000;
const STABLE_CONNECTION_MS = 10_000;

/** Exponential backoff for every retry, including server-full/role-cap closes. */
export function reconnectDelayMs(attempt: number): number {
  const normalized = Math.max(1, Math.floor(attempt));
  return Math.min(1000 * 2 ** (normalized - 1), MAX_RECONNECT_DELAY_MS);
}

/** 1012 is a planned restart/drain; other close codes get the generic retry UI. */
export function reconnectMessageKey(closeCode: number): string {
  return closeCode === 1012 ? "status.serverRestart" : "status.reconnecting";
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private stableTimer: any = null;
  private reconnectAttempt = 0;
  private isCleaningUp = false;
  private url: string;

  private messageCallbacks: ((parsedState: any) => void)[] = [];
  private disconnectCallbacks: (() => void)[] = [];
  private statusCallbacks: ((status: string, details?: any) => void)[] = [];
  private pingCallbacks: ((latency: number) => void)[] = [];
  private yourIdCallbacks: ((myId: string) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  public onMessage(cb: (parsedState: any) => void) {
    this.messageCallbacks.push(cb);
  }
  public onDisconnect(cb: () => void) {
    this.disconnectCallbacks.push(cb);
  }
  public onStatus(cb: (status: string, details?: any) => void) {
    this.statusCallbacks.push(cb);
  }
  public onPing(cb: (latency: number) => void) {
    this.pingCallbacks.push(cb);
  }
  public onYourId(cb: (myId: string) => void) {
    this.yourIdCallbacks.push(cb);
  }

  public connect() {
    this.isCleaningUp = false;
    // Identity is carried by the HttpOnly session cookie on the handshake.
    this.socket = new WebSocket(this.url);
    this.socket.binaryType = "arraybuffer";
    this._setupSocketEvents();
  }

  public disconnect() {
    this.isCleaningUp = true;
    this._clearTimers();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public send(action: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(action);
    }
  }

  private _clearTimers() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _setupSocketEvents() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.statusCallbacks.forEach((cb) => {
        cb("connected");
      });
      this._startPing();
      // Only a connection that stays up for a while proves the server is
      // accepting us. Otherwise a full/role-capped server would reset the
      // backoff on every accept-then-close cycle.
      this.stableTimer = setTimeout(() => {
        this.reconnectAttempt = 0;
      }, STABLE_CONNECTION_MS);
    };

    this.socket.onclose = (event: CloseEvent) => {
      this._clearTimers();
      this.socket = null;
      this.disconnectCallbacks.forEach((cb) => {
        cb();
      });
      if (!this.isCleaningUp) this._reconnect(event.code);
    };

    this.socket.onerror = () => {};
    this.socket.onmessage = (event) => this._handleMessage(event);
  }

  private _startPing() {
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(`PING:${performance.now()}`);
      }
    }, 2000);
  }

  private _handleMessage(event: MessageEvent) {
    if (typeof event.data === "string") {
      if (event.data.startsWith("PONG:")) {
        const timestamp = parseFloat(event.data.substring(5));
        const latency = performance.now() - timestamp;
        this.pingCallbacks.forEach((cb) => {
          cb(latency);
        });
      }
      return;
    }

    try {
      const decompressedBuffer = decompress(new Uint8Array(event.data));
      const parsedState = decodeGameStateFrame(decompressedBuffer);

      if (parsedState.type === "SERVER_RESTART") {
        const msg = parsedState.restart_message || undefined;
        this.statusCallbacks.forEach((cb) => {
          cb("reconnecting", {
            msg,
            msgKey: msg ? undefined : "status.serverRestart",
          });
        });
        this.socket?.close(1000, "Server Restart");
        return;
      }

      if (parsedState.your_id) {
        this.yourIdCallbacks.forEach((cb) => {
          cb(parsedState.your_id);
        });
      }

      this.messageCallbacks.forEach((cb) => {
        cb(parsedState);
      });
    } catch (err) {
      console.error("Worker packet decompression or Protobuf decode error:", err);
    }
  }

  private _reconnect(closeCode: number) {
    this.reconnectAttempt++;
    const delay = reconnectDelayMs(this.reconnectAttempt);

    // 4002 (server full), 4003 (role cap) and 1012 (restart/drain) all go
    // through backoff: retrying immediately would only spin the server.
    this.statusCallbacks.forEach((cb) => {
      cb("reconnecting", {
        msgKey: reconnectMessageKey(closeCode),
        msgParams: { seconds: Math.ceil(delay / 1000) },
        closeCode,
      });
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
