// ROLE: WebSocket-интерфейс к воркеру. Не бизнес-логика.
import { gridSize } from "./Config";

export type NetworkStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface FrameInput {
  turn: number;
  accelerating: boolean;
  mode: string;
}

export class NetworkManager {
  private worker: Worker | null = null;
  private isWaitingForFrame = false;
  private frameTimeoutId: number | null = null;

  private onStatusChange?: (status: NetworkStatus, msg?: string, msgKey?: string, msgParams?: any) => void;
  private onPing?: (latency: number) => void;
  private onYourId?: (id: string) => void;
  private onFrameData?: (msg: any) => void;
  private onDisconnect?: () => void;

  constructor() {}

  public connect(nickname: string, skin: string, role: string = "player"): void {
    if (this.worker) {
      this.close();
    }

    // Initialize worker with relative module URL standard in Vite
    this.worker = new Worker(
      new URL("../worker/worker.ts", import.meta.url),
      { type: "module" }
    );

    this.worker.onmessage = this.handleWorkerMessage;

    const wsUrl = this.buildWsUrl(nickname, skin, role);
    this.worker.postMessage({ type: "CONNECT", url: wsUrl });
  }

  public send(msg: string): void {
    this.worker?.postMessage({ type: "SEND", data: msg });
  }

  public requestFrame(dt: number, myId: string, input: any): void {
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
      gridSize,
      localInput: input,
      sentTime: performance.now()
    });
  }

  public close(): void {
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
    onStatusChange?: (status: NetworkStatus, msg?: string, msgKey?: string, msgParams?: any) => void;
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

  private buildWsUrl(nickname: string, skin: string, role: string): string {
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
    const wsPort = isStandardPort ? "" : ":8000";
    const trimmed = nickname.trim() || "Snake";
    let url = `${protocol}${host}${wsPort}/ws/?nickname=${encodeURIComponent(trimmed)}&skin=${encodeURIComponent(skin)}&role=${encodeURIComponent(role)}`;
    
    const savedId = localStorage.getItem("snake_client_id");
    if (savedId) {
      url += `&client_id=${encodeURIComponent(savedId)}`;
    }
    return url;
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
      localStorage.setItem("snake_client_id", msg.your_id);
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
