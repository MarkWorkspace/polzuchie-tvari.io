// ROLE: Regression tests for session bootstrap, WS URL identity, reconnect backoff,
// frame correlation and worker watchdog/restart behavior.
import { afterEach, describe, expect, it, vi } from "vitest";
import { reconnectDelayMs, reconnectMessageKey, WebSocketClient } from "../worker/WebSocketClient";
import {
  buildGameWsUrl,
  buildSessionUrl,
  clearLegacyClientId,
  ensurePlayerSession,
  FRAME_TIMEOUT_STALL_THRESHOLD,
  isCurrentFrameResponse,
  LEGACY_CLIENT_ID_STORAGE_KEY,
  NetworkManager,
} from "./NetworkManager";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  public url: string;
  public readyState = 0;
  public binaryType = "blob";
  public sent: string[] = [];
  public onopen: (() => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  serverClose(code: number) {
    this.onclose?.({ code } as CloseEvent);
  }
}

class FakeNetworkWorker {
  static instances: FakeNetworkWorker[] = [];

  public url: string | URL;
  public options: WorkerOptions | undefined;
  public postMessage = vi.fn();
  public terminate = vi.fn();
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    FakeNetworkWorker.instances.push(this);
  }
}

describe("player session bootstrap", () => {
  it("targets backend :8000 in dev and /ws/session in production", () => {
    expect(buildSessionUrl({ protocol: "http:", hostname: "127.0.0.1" }, true)).toBe(
      "http://127.0.0.1:8000/session",
    );
    expect(buildSessionUrl({ protocol: "https:", hostname: "game.example" }, true)).toBe(
      "https://game.example:8000/session",
    );
    expect(buildSessionUrl({ protocol: "https:", hostname: "game.example" }, false)).toBe(
      "/ws/session",
    );
  });

  it("POSTs /session with credentials and accepts the cookie response", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const result = await ensurePlayerSession(
      "http://127.0.0.1:8000/session",
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/session",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("reports an HTTP status instead of starting the worker", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 429 }));
    const result = await ensurePlayerSession(
      "http://127.0.0.1:8000/session",
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: false, status: 429, error: "HTTP 429" });
  });

  it("reports a transport failure without a status", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await ensurePlayerSession(
      "http://127.0.0.1:8000/session",
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ ok: false, status: null, error: "network down" });
  });

  it("drops the legacy localStorage client id", () => {
    const storage = { removeItem: vi.fn() };
    clearLegacyClientId(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_CLIENT_ID_STORAGE_KEY);

    const throwingStorage = {
      removeItem: () => {
        throw new Error("storage denied");
      },
    };
    expect(() => clearLegacyClientId(throwingStorage)).not.toThrow();
  });
});

describe("game WebSocket URL", () => {
  const devLocation = { protocol: "http:", hostname: "127.0.0.1", port: "5173" };
  const prodLocation = { protocol: "https:", hostname: "game.example", port: "" };

  it("carries role but never a client_id", () => {
    const devUrl = buildGameWsUrl("Snake One", "#22c55e", "player", devLocation, true);
    expect(devUrl).toBe("ws://127.0.0.1:8000/ws/?nickname=Snake%20One&skin=%2322c55e&role=player");
    expect(devUrl).not.toContain("client_id");

    const prodUrl = buildGameWsUrl("Спектатор", "spectator", "spectator", prodLocation, false);
    expect(prodUrl).toBe(
      "wss://game.example/ws/?nickname=%D0%A1%D0%BF%D0%B5%D0%BA%D1%82%D0%B0%D1%82%D0%BE%D1%80&skin=spectator&role=spectator",
    );
    expect(prodUrl).not.toContain("client_id");
  });
});

describe("frame request correlation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createManager() {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: (handler: () => void, timeout: number) =>
        globalThis.setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (id: number) => globalThis.clearTimeout(id),
    });

    const manager = new NetworkManager();
    const postMessage = vi.fn();
    (manager as any).worker = { postMessage };
    const frames: any[] = [];
    manager.setCallbacks({ onFrameData: (msg) => frames.push(msg) });
    return { manager, postMessage, frames };
  }

  function deliver(manager: NetworkManager, msg: any): void {
    (manager as any).handleWorkerMessage({ data: msg } as MessageEvent);
  }

  it("accepts matching and legacy responses, rejects stale ids", () => {
    expect(isCurrentFrameResponse({ requestId: 2 }, 2)).toBe(true);
    expect(isCurrentFrameResponse({ requestId: 1 }, 2)).toBe(false);
    expect(isCurrentFrameResponse({}, 2)).toBe(true);
    expect(isCurrentFrameResponse({ requestId: 2 }, null)).toBe(false);
    expect(isCurrentFrameResponse({ requestId: Number.NaN }, 2)).toBe(true);
  });

  it("tags each request and ignores a stale FRAME_DATA", () => {
    const { manager, postMessage, frames } = createManager();

    manager.requestFrame(0.016, "me", { turn: 0 });
    const request = postMessage.mock.calls[0][0];
    expect(request.requestId).toBe(1);
    expect(request).not.toHaveProperty("sentTime");
    expect(manager.getWaitingForFrame()).toBe(true);

    // One in-flight request at a time.
    manager.requestFrame(0.016, "me", { turn: 0 });
    expect(postMessage).toHaveBeenCalledTimes(1);

    deliver(manager, { type: "FRAME_DATA", requestId: 999, camX: 1, camY: 2 });
    deliver(manager, { type: "FRAME_UNAVAILABLE", requestId: 999 });
    expect(frames).toHaveLength(0);
    expect(manager.getWaitingForFrame()).toBe(true);

    deliver(manager, { type: "FRAME_DATA", requestId: 1, camX: 1, camY: 2 });
    expect(frames).toHaveLength(1);
    expect(manager.getWaitingForFrame()).toBe(false);
  });

  it("clears the pending request on FRAME_UNAVAILABLE without emitting a frame", () => {
    const { manager, postMessage, frames } = createManager();

    manager.requestFrame(0.016, "me", { turn: 0 });
    deliver(manager, { type: "FRAME_UNAVAILABLE", requestId: 1 });

    expect(frames).toHaveLength(0);
    expect(manager.getWaitingForFrame()).toBe(false);

    // The next tick may request again with a fresh id.
    manager.requestFrame(0.016, "me", { turn: 0 });
    expect(postMessage.mock.calls[1][0].requestId).toBe(2);
  });

  it("accepts a legacy FRAME_DATA without a request id", () => {
    const { manager, frames } = createManager();

    manager.requestFrame(0.016, "me", { turn: 0 });
    deliver(manager, { type: "FRAME_DATA", camX: 1, camY: 2 });

    expect(frames).toHaveLength(1);
    expect(manager.getWaitingForFrame()).toBe(false);
  });

  it("ignores a response that arrives after the main-side timeout", () => {
    const { manager, frames } = createManager();

    manager.requestFrame(0.016, "me", { turn: 0 });
    vi.advanceTimersByTime(100);
    expect(manager.getWaitingForFrame()).toBe(false);

    deliver(manager, { type: "FRAME_DATA", requestId: 1, camX: 1, camY: 2 });
    expect(frames).toHaveLength(0);
  });
});

describe("worker watchdog", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeNetworkWorker.instances = [];
  });

  async function connectManager() {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      location: { protocol: "http:", hostname: "127.0.0.1", port: "5173" },
      setTimeout: (handler: () => void, timeout: number) =>
        globalThis.setTimeout(handler, timeout) as unknown as number,
      clearTimeout: (id: number) => globalThis.clearTimeout(id),
    });
    vi.stubGlobal("Worker", FakeNetworkWorker);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const manager = new NetworkManager();
    const statuses: Array<{ status: string; msgKey?: string; msgParams?: any }> = [];
    const onWorkerRestart = vi.fn();
    const onFatalError = vi.fn();
    manager.setCallbacks({
      onStatusChange: (status, _msg, msgKey, msgParams) =>
        statuses.push({ status, msgKey, msgParams }),
      onWorkerRestart,
      onFatalError,
    });

    await manager.connect("Snake", "#22c55e", "player");
    return { manager, statuses, onWorkerRestart, onFatalError, fetchMock };
  }

  it("recreates the worker after onerror and re-fetches the player session", async () => {
    const { statuses, onWorkerRestart, fetchMock } = await connectManager();
    expect(FakeNetworkWorker.instances).toHaveLength(1);
    const firstWorker = FakeNetworkWorker.instances[0];

    firstWorker.onerror?.({ message: "boom" } as ErrorEvent);

    expect(onWorkerRestart).toHaveBeenCalledTimes(1);
    expect(firstWorker.terminate).toHaveBeenCalledTimes(1);
    expect(statuses.at(-1)).toMatchObject({
      status: "reconnecting",
      msgKey: "status.workerRestart",
      msgParams: { attempt: 1 },
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(FakeNetworkWorker.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(FakeNetworkWorker.instances).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeNetworkWorker.instances[1].postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CONNECT" }),
    );
  });

  it("treats onmessageerror as a worker failure", async () => {
    const { onWorkerRestart } = await connectManager();

    FakeNetworkWorker.instances[0].onmessageerror?.({} as MessageEvent);

    expect(onWorkerRestart).toHaveBeenCalledTimes(1);
    expect(FakeNetworkWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it("reports a fatal error after the restart budget is exhausted", async () => {
    const { statuses, onFatalError } = await connectManager();

    for (let attempt = 1; attempt <= 3; attempt++) {
      FakeNetworkWorker.instances.at(-1)?.onerror?.({ message: "boom" } as ErrorEvent);
      await vi.advanceTimersByTimeAsync(reconnectDelayMs(attempt));
    }

    expect(FakeNetworkWorker.instances).toHaveLength(4);
    FakeNetworkWorker.instances[3].onerror?.({ message: "boom" } as ErrorEvent);

    expect(onFatalError).toHaveBeenCalledWith("worker");
    expect(FakeNetworkWorker.instances).toHaveLength(4);
    expect(statuses.at(-1)).toMatchObject({
      status: "disconnected",
      msgKey: "error.workerCrashed",
    });
  });

  it("treats consecutive frame timeouts as a stalled worker", async () => {
    const { manager, onWorkerRestart } = await connectManager();

    for (let i = 1; i < FRAME_TIMEOUT_STALL_THRESHOLD; i++) {
      manager.requestFrame(0.016, "me", { turn: 0 });
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(onWorkerRestart).not.toHaveBeenCalled();

    manager.requestFrame(0.016, "me", { turn: 0 });
    await vi.advanceTimersByTimeAsync(100);

    expect(onWorkerRestart).toHaveBeenCalledTimes(1);
    expect(FakeNetworkWorker.instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it("does not restart the worker after a manual close", async () => {
    const { manager, fetchMock } = await connectManager();

    FakeNetworkWorker.instances[0].onerror?.({ message: "boom" } as ErrorEvent);
    manager.close();
    await vi.advanceTimersByTimeAsync(reconnectDelayMs(1));

    expect(FakeNetworkWorker.instances).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("WebSocket reconnect policy", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
  });

  it("uses capped exponential backoff", () => {
    expect(reconnectDelayMs(1)).toBe(1000);
    expect(reconnectDelayMs(2)).toBe(2000);
    expect(reconnectDelayMs(6)).toBe(30000);
    expect(reconnectDelayMs(50)).toBe(30000);
  });

  it.each([4002, 4003])("backs off after close code %i", (code) => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const client = new WebSocketClient("ws://127.0.0.1:8000/ws/?role=player");
    const statuses: Array<{ status: string; details: any }> = [];
    client.onStatus((status, details) => statuses.push({ status, details }));
    client.connect();

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe("ws://127.0.0.1:8000/ws/?role=player");
    expect(FakeWebSocket.instances[0].url).not.toContain("client_id");

    FakeWebSocket.instances[0].serverClose(code);
    expect(statuses.at(-1)?.details.closeCode).toBe(code);
    vi.advanceTimersByTime(999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    // A second immediate rejection must extend the delay, not spin every second.
    FakeWebSocket.instances[1].serverClose(code);
    vi.advanceTimersByTime(1999);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);

    client.disconnect();
  });

  it("retries after a 1012 restart with the restart status", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    expect(reconnectMessageKey(1012)).toBe("status.serverRestart");

    const client = new WebSocketClient("ws://127.0.0.1:8000/ws/?role=player");
    const statuses: Array<{ status: string; details: any }> = [];
    client.onStatus((status, details) => statuses.push({ status, details }));
    client.connect();

    FakeWebSocket.instances[0].serverClose(1012);
    expect(statuses.at(-1)?.details.msgKey).toBe("status.serverRestart");
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    client.disconnect();
  });
});
