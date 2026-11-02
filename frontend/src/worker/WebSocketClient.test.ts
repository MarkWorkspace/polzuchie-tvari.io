// ROLE: Тесты seq-цепочки кадров и клиентского RESYNC (cooldown, decode error, drop gap). Не E2E.

import { deflate } from "pako";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameSequencer, WebSocketClient } from "./WebSocketClient";

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

  deliver(data: ArrayBuffer) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  let remaining = value >>> 0;
  while (remaining > 0x7f) {
    bytes.push((remaining & 0x7f) | 0x80);
    remaining >>>= 7;
  }
  bytes.push(remaining);
  return bytes;
}

function compressBytes(bytes: number[]): ArrayBuffer {
  const compressed = deflate(new Uint8Array(bytes));
  const copy = new Uint8Array(compressed.length);
  copy.set(compressed);
  return copy.buffer;
}

/** Minimal GameStateFrame: type field 1 plus optional frame_seq field 19. */
function encodeFrame(type: "FULL" | "DELTA", seq?: number): ArrayBuffer {
  const bytes = [0x08, type === "FULL" ? 0x01 : 0x02];
  if (seq !== undefined) {
    bytes.push(0x98, 0x01, ...encodeVarint(seq));
  }
  return compressBytes(bytes);
}

function connectClient(): { client: WebSocketClient; socket: FakeWebSocket } {
  const client = new WebSocketClient("ws://test/ws");
  client.connect();
  const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  socket.readyState = FakeWebSocket.OPEN;
  return { client, socket };
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.spyOn(performance, "now").mockReturnValue(1000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FrameSequencer", () => {
  it("accepts a FULL then exactly sequential DELTAs", () => {
    const sequencer = new FrameSequencer();

    expect(sequencer.observe({ type: "FULL", frame_seq: 10 })).toEqual({
      accept: true,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 11 })).toEqual({
      accept: true,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 12 })).toEqual({
      accept: true,
      resync: false,
    });
  });

  it("drops a DELTA gap and asks for resync without advancing the chain", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 10 });

    expect(sequencer.observe({ type: "DELTA", frame_seq: 12 })).toEqual({
      accept: false,
      resync: true,
    });
    // The broken chain keeps rejecting until a FULL arrives.
    expect(sequencer.observe({ type: "DELTA", frame_seq: 13 })).toEqual({
      accept: false,
      resync: true,
    });
  });

  it("drops a DELTA that arrives before the first FULL without resyncing", () => {
    const sequencer = new FrameSequencer();

    expect(sequencer.observe({ type: "DELTA", frame_seq: 1 })).toEqual({
      accept: false,
      resync: false,
    });
  });

  it("accepts legacy DELTAs without frame_seq", () => {
    const sequencer = new FrameSequencer();

    expect(sequencer.observe({ type: "DELTA" })).toEqual({ accept: true, resync: false });
    sequencer.observe({ type: "FULL" });
    expect(sequencer.observe({ type: "DELTA" })).toEqual({ accept: true, resync: false });
  });

  it("full resets the sequence even after a long chain", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 100 });

    expect(sequencer.observe({ type: "FULL", frame_seq: 1 })).toEqual({
      accept: true,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 2 })).toEqual({
      accept: true,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 101 })).toEqual({
      accept: false,
      resync: true,
    });
  });

  it("clears the chain when a FULL has no frame_seq", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 5 });

    expect(sequencer.observe({ type: "FULL" })).toEqual({ accept: true, resync: false });
    // Sequenced deltas cannot be validated without a sequenced FULL.
    expect(sequencer.observe({ type: "DELTA", frame_seq: 6 })).toEqual({
      accept: false,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA" })).toEqual({ accept: true, resync: false });
  });

  it("wraps the uint32 sequence from 0xffffffff to 0", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 0xffffffff });

    expect(sequencer.observe({ type: "DELTA", frame_seq: 0 })).toEqual({
      accept: true,
      resync: false,
    });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 1 })).toEqual({
      accept: true,
      resync: false,
    });
  });

  it("ignores unknown frame types and SERVER_RESTART", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 7 });

    expect(sequencer.observe({ type: "BOGUS", frame_seq: 8 })).toEqual({
      accept: false,
      resync: false,
    });
    expect(sequencer.observe({ type: "SERVER_RESTART" })).toEqual({
      accept: false,
      resync: false,
    });
    // The rejected frames must not disturb the chain.
    expect(sequencer.observe({ type: "DELTA", frame_seq: 8 })).toEqual({
      accept: true,
      resync: false,
    });
  });

  it("treats a missing type as a legacy FULL", () => {
    const sequencer = new FrameSequencer();

    expect(sequencer.observe({ frame_seq: 3 })).toEqual({ accept: true, resync: false });
    expect(sequencer.observe({ type: "DELTA", frame_seq: 4 })).toEqual({
      accept: true,
      resync: false,
    });
  });

  it("reset() forces a new chain", () => {
    const sequencer = new FrameSequencer();
    sequencer.observe({ type: "FULL", frame_seq: 10 });
    sequencer.reset();

    expect(sequencer.observe({ type: "DELTA", frame_seq: 11 })).toEqual({
      accept: false,
      resync: false,
    });
  });
});

describe("WebSocketClient seq/resync", () => {
  it("drops a gap, sends exactly one RESYNC, then recovers on FULL", () => {
    const { client, socket } = connectClient();
    const messages: any[] = [];
    client.onMessage((state) => messages.push(state));

    socket.deliver(encodeFrame("FULL", 10));
    socket.deliver(encodeFrame("DELTA", 11));
    socket.deliver(encodeFrame("DELTA", 13));
    socket.deliver(encodeFrame("DELTA", 14));

    expect(messages.map((m) => m.frame_seq)).toEqual([10, 11]);
    expect(socket.sent).toEqual(["RESYNC"]);

    socket.deliver(encodeFrame("FULL", 20));
    socket.deliver(encodeFrame("DELTA", 21));

    expect(messages.map((m) => m.frame_seq)).toEqual([10, 11, 20, 21]);
    expect(socket.sent).toEqual(["RESYNC"]);
    client.disconnect();
  });

  it("requestResync sends only while OPEN and honors the 1 s cooldown", () => {
    const { client, socket } = connectClient();

    socket.readyState = 0;
    expect(client.requestResync(1000)).toBe(false);
    expect(socket.sent).toEqual([]);

    socket.readyState = FakeWebSocket.OPEN;
    expect(client.requestResync(1000)).toBe(true);
    expect(socket.sent).toEqual(["RESYNC"]);

    expect(client.requestResync(1500)).toBe(false);
    expect(client.requestResync(1999)).toBe(false);
    expect(socket.sent).toEqual(["RESYNC"]);

    expect(client.requestResync(2000)).toBe(true);
    expect(socket.sent).toEqual(["RESYNC", "RESYNC"]);
    client.disconnect();
  });

  it("connect() resets both the sequence and the resync cooldown", () => {
    const { client, socket } = connectClient();
    client.requestResync(1000);
    expect(socket.sent).toEqual(["RESYNC"]);

    client.connect();
    const nextSocket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    nextSocket.readyState = FakeWebSocket.OPEN;
    expect(client.requestResync(1000)).toBe(true);
    expect(nextSocket.sent).toEqual(["RESYNC"]);

    const messages: any[] = [];
    client.onMessage((state) => messages.push(state));
    nextSocket.deliver(encodeFrame("DELTA", 50));
    expect(messages).toEqual([]);

    nextSocket.deliver(encodeFrame("FULL", 50));
    nextSocket.deliver(encodeFrame("DELTA", 51));
    expect(messages.map((m) => m.frame_seq)).toEqual([50, 51]);
    client.disconnect();
  });

  it("requests a resync on a decompression error without emitting state", () => {
    const { client, socket } = connectClient();
    const messages: any[] = [];
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    client.onMessage((state) => messages.push(state));

    const broken = new Uint8Array([0xff, 0xff, 0xff, 0xff]).buffer;
    socket.deliver(broken);
    socket.deliver(broken);

    expect(messages).toEqual([]);
    expect(socket.sent).toEqual(["RESYNC"]);
    expect(errors).toHaveBeenCalledTimes(2);
    client.disconnect();
  });

  it("invalidates the chain on a Protobuf decode error and recovers on FULL", () => {
    const { client, socket } = connectClient();
    const messages: any[] = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    client.onMessage((state) => messages.push(state));

    socket.deliver(encodeFrame("FULL", 10));
    // Valid zlib, but the frame ends after the type tag: readVarint throws.
    socket.deliver(compressBytes([0x08]));
    socket.deliver(encodeFrame("DELTA", 11));

    expect(messages.map((m) => m.frame_seq)).toEqual([10]);
    expect(socket.sent).toEqual(["RESYNC"]);

    socket.deliver(encodeFrame("FULL", 11));
    socket.deliver(encodeFrame("DELTA", 12));

    expect(messages.map((m) => m.frame_seq)).toEqual([10, 11, 12]);
    client.disconnect();
  });
});
