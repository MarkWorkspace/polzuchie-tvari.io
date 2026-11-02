// ROLE: WebSocket-соединение, реконнект, ping/pong и seq-контроль кадров (RESYNC). Не бизнес-логика.

import { decompress } from "./DeltaDecoder";
import { decodeGameStateFrame } from "./shared/ProtoFrameDecoder";

const MAX_RECONNECT_DELAY_MS = 30_000;
const STABLE_CONNECTION_MS = 10_000;
const RESYNC_COOLDOWN_MS = 1000;
const RESYNC_MESSAGE = "RESYNC";

/** Exponential backoff for every retry, including server-full/role-cap closes. */
export function reconnectDelayMs(attempt: number): number {
  const normalized = Math.max(1, Math.floor(attempt));
  return Math.min(1000 * 2 ** (normalized - 1), MAX_RECONNECT_DELAY_MS);
}

/** 1012 is a planned restart/drain; other close codes get the generic retry UI. */
export function reconnectMessageKey(closeCode: number): string {
  return closeCode === 1012 ? "status.serverRestart" : "status.reconnecting";
}

export interface FrameSequenceDecision {
  /** The frame may be applied by the worker. */
  accept: boolean;
  /** The delta chain is broken and a FULL frame must be requested. */
  resync: boolean;
}

/**
 * Tracks the server `frame_seq` chain for one connection.
 *
 * FULL opens a new chain; DELTA must be exactly the next uint32 value. A gap
 * drops the frame and asks for a FULL, while a DELTA before the first FULL is
 * dropped silently: requesting a resync there would only duplicate the pending
 * handshake FULL. Frames without `frame_seq` are legacy and always accepted.
 */
export class FrameSequencer {
  private lastSeq: number | null = null;

  public reset(): void {
    this.lastSeq = null;
  }

  public observe(parsedState: any): FrameSequenceDecision {
    const type = parsedState?.type;

    if (type === "FULL" || type === undefined) {
      const seq = parsedState?.frame_seq;
      this.lastSeq = typeof seq === "number" ? seq >>> 0 : null;
      return { accept: true, resync: false };
    }

    if (type === "DELTA") {
      const seq = parsedState?.frame_seq;
      if (typeof seq !== "number") {
        // Legacy server: no sequence to validate, keep applying deltas.
        return { accept: true, resync: false };
      }
      if (this.lastSeq === null) {
        // The initial FULL has not arrived yet (or was lost); wait for it.
        return { accept: false, resync: false };
      }
      const normalized = seq >>> 0;
      if (normalized === (this.lastSeq + 1) >>> 0) {
        this.lastSeq = normalized;
        return { accept: true, resync: false };
      }
      return { accept: false, resync: true };
    }

    // SERVER_RESTART and unknown types never apply to the game state.
    return { accept: false, resync: false };
  }
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private stableTimer: any = null;
  private reconnectAttempt = 0;
  private isCleaningUp = false;
  private url: string;
  private sequencer = new FrameSequencer();
  private lastResyncAt: number | null = null;

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
    // A new connection starts a new server-side sequence and cooldown window.
    this.sequencer.reset();
    this.lastResyncAt = null;
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

  /**
   * Ask the server for a fresh FULL frame. Returns true only when the control
   * message was actually sent; repeats inside the cooldown are ignored so a
   * broken chain cannot force a FULL on every tick. The server enforces the
   * same 1 s window per connection.
   */
  public requestResync(now: number = performance.now()): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (this.lastResyncAt !== null && now - this.lastResyncAt < RESYNC_COOLDOWN_MS) return false;

    this.socket.send(RESYNC_MESSAGE);
    this.lastResyncAt = now;
    return true;
  }

  /**
   * Forget the local chain after a frame failed to decode. The accepted seq was
   * already advanced, so applying the next DELTA would silently skip the lost
   * change; only a fresh FULL may reopen the chain.
   */
  public invalidateSequence(): void {
    this.sequencer.reset();
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

      const decision = this.sequencer.observe(parsedState);
      if (decision.resync) this.requestResync();
      if (!decision.accept) return;

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
      // A corrupt/truncated frame leaves the delta chain unusable: wait for a
      // FULL instead of silently dropping one frame and applying the next.
      this.invalidateSequence();
      this.requestResync();
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
