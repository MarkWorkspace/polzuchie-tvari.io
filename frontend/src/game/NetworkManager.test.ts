// ROLE: Regression tests for player session bootstrap, WS URL identity and reconnect backoff.
import { afterEach, describe, expect, it, vi } from "vitest";
import { reconnectDelayMs, reconnectMessageKey, WebSocketClient } from "../worker/WebSocketClient";
import {
  buildGameWsUrl,
  buildSessionUrl,
  clearLegacyClientId,
  ensurePlayerSession,
  LEGACY_CLIENT_ID_STORAGE_KEY,
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
