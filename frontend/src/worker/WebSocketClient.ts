// ROLE: WebSocket-соединение, реконнект, ping/pong. Не бизнес-логика.

import { decompress } from "./DeltaDecoder";
import { decode } from "@msgpack/msgpack";

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private reconnectAttempt = 0;
  private isCleaningUp = false;
  private url: string;
  private myId: string | null = null;

  private messageCallbacks: ((parsedState: any) => void)[] = [];
  private disconnectCallbacks: (() => void)[] = [];
  private statusCallbacks: ((status: string, details?: any) => void)[] = [];
  private pingCallbacks: ((latency: number) => void)[] = [];
  private yourIdCallbacks: ((myId: string) => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  public onMessage(cb: (parsedState: any) => void) { this.messageCallbacks.push(cb); }
  public onDisconnect(cb: () => void) { this.disconnectCallbacks.push(cb); }
  public onStatus(cb: (status: string, details?: any) => void) { this.statusCallbacks.push(cb); }
  public onPing(cb: (latency: number) => void) { this.pingCallbacks.push(cb); }
  public onYourId(cb: (myId: string) => void) { this.yourIdCallbacks.push(cb); }

  public connect() {
    this.isCleaningUp = false;
    let finalUrl = this.url;
    if (this.myId) {
      const separator = finalUrl.includes("?") ? "&" : "?";
      finalUrl = `${finalUrl}${separator}client_id=${this.myId}`;
    }
    this.socket = new WebSocket(finalUrl);
    this.socket.binaryType = "arraybuffer";
    this._setupSocketEvents();
  }

  public disconnect() {
    this.isCleaningUp = true;
    this._clearTimers();
    this.myId = null;
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
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }

  private _setupSocketEvents() {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.statusCallbacks.forEach(cb => cb("connected"));
      this._startPing();
    };

    this.socket.onclose = () => {
      this._clearTimers();
      this.disconnectCallbacks.forEach(cb => cb());
      if (!this.isCleaningUp) this._reconnect();
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

  private async _handleMessage(event: MessageEvent) {
    if (typeof event.data === "string") {
      if (event.data.startsWith("PONG:")) {
        const timestamp = parseFloat(event.data.substring(5));
        const latency = performance.now() - timestamp;
        this.pingCallbacks.forEach(cb => cb(latency));
      }
      return;
    }

    try {
      const decompressedBuffer = await decompress(new Uint8Array(event.data));
      const parsedState = decode(new Uint8Array(decompressedBuffer)) as any;
      
      if (parsedState.type === "SERVER_RESTART") {
        this.statusCallbacks.forEach(cb => cb("reconnecting", {
          msg: parsedState.message || undefined,
          msgKey: parsedState.message ? undefined : "status.serverRestart"
        }));
        this.socket?.close(1000, "Server Restart");
        return;
      }

      if (parsedState.your_id) {
        this.myId = parsedState.your_id;
        this.yourIdCallbacks.forEach(cb => cb(parsedState.your_id));
      }

      this.messageCallbacks.forEach(cb => cb(parsedState));
    } catch (err) {
      console.error("Worker packet decompression or MsgPack decode error:", err);
    }
  }

  private _reconnect() {
    this.reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 30000);
    
    this.statusCallbacks.forEach(cb => cb("reconnecting", {
      msgKey: "status.reconnecting",
      msgParams: { seconds: Math.ceil(delay / 1000) }
    }));

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
