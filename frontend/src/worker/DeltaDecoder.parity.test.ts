// ROLE: Parity-тест сетевого кадра. Декодирует бинарные фикстуры через DeltaDecoder и сравнивает с expected JSON.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decompress, decodeFullState, decodeDeltaState } from "./DeltaDecoder";
import { snake } from "./shared/snake_proto";

const FIXTURES_DIR = resolve(
  __dirname, "../../../tests_shared/golden_frames"
);

const MAP_W = 100;
const MAP_H = 100;

function loadBin(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

function loadExpected(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), "utf-8"));
}

describe("Frame parity (golden fixtures)", () => {
  it("decodes FULL frame and matches expected structure", () => {
    const compressed = loadBin("frame_full.bin");
    const decompressed = decompress(compressed);
    const message = snake.GameStateFrame.decode(decompressed);
    const parsed = snake.GameStateFrame.toObject(message, { enums: String, defaults: false }) as any;
    const expected = loadExpected("frame_full.expected.json");

    const state = decodeFullState(parsed, MAP_W, MAP_H);

    const expPlayers = expected["players"] as Record<string, unknown>;
    expect(Object.keys(state.players).sort()).toEqual(
      Object.keys(expPlayers).sort()
    );

    for (const pid of Object.keys(expPlayers)) {
      const sp = state.players[pid];
      const ep = expPlayers[pid] as Record<string, unknown>;

      expect(Array.isArray(sp.body)).toBe(true);
      const expBody = ep["body"] as number[];
      expect(sp.body.length).toBe(expBody.length);
      for (let i = 0; i < expBody.length; i++) {
        expect(Math.abs(sp.body[i] - expBody[i])).toBeLessThan(0.01);
      }

      expect(sp.score ?? 0).toBe(ep["score"] ?? 0);
      expect(sp.kills ?? 0).toBe(ep["kills"] ?? 0);
      expect(sp.deaths ?? 0).toBe(ep["deaths"] ?? 0);
    }

    expect(state.foods.length).toBe(
      (expected["foods"] as unknown[]).length
    );
    expect(state.portals).toBeDefined();
    expect(state.server_tick_rate).toBe(expected["server_tick_rate"]);
  });

  it("decodes DELTA frame and matches expected structure", () => {
    const compressed = loadBin("frame_delta.bin");
    const decompressed = decompress(compressed);
    const message = snake.GameStateFrame.decode(decompressed);
    const parsed = snake.GameStateFrame.toObject(message, { enums: String, defaults: false }) as any;
    const expected = loadExpected("frame_delta.expected.json");

    const fullCompressed = loadBin("frame_full.bin");
    const fullDecompressed = decompress(fullCompressed);
    const fullMessage = snake.GameStateFrame.decode(fullDecompressed);
    const fullParsed = snake.GameStateFrame.toObject(fullMessage, { enums: String, defaults: false }) as any;
    const prevState = decodeFullState(fullParsed, MAP_W, MAP_H);

    const state = decodeDeltaState(parsed, prevState, MAP_W, MAP_H);

    const expPlayers = expected["players"] as Record<string, unknown>;
    expect(Object.keys(state.players).sort()).toEqual(
      Object.keys(expPlayers).sort()
    );

    for (const pid of Object.keys(expPlayers)) {
      const sp = state.players[pid];
      const ep = expPlayers[pid] as Record<string, unknown>;

      expect(sp.score ?? 0).toBe(ep["score"] ?? 0);
      expect(sp.kills ?? 0).toBe(ep["kills"] ?? 0);
      expect(sp.body.length).toBeGreaterThan(0);
      if (ep["length"]) {
        expect(sp.body.length / 2).toBe(ep["length"]);
      }
    }

    expect(state.server_tick_rate).toBe(expected["server_tick_rate"]);
  });

  it("clears portals, black holes, and tombstones when they are undefined in the delta payload", () => {
    const prevState = {
      server_tick_rate: 30,
      players: {},
      foods: [],
      portals: [{ id: "p1" }],
      black_holes: [{ id: "bh1" }],
      tombstones: [{ id: "t1" }]
    } as any;

    const deltaPayload = {
      players: {},
      eaten_foods: [],
      moved_foods: [],
      new_foods: []
    } as any;

    const state = decodeDeltaState(deltaPayload, prevState, MAP_W, MAP_H);
    expect(state.portals).toEqual([]);
    expect(state.black_holes).toEqual([]);
    expect(state.tombstones).toEqual([]);
  });
});
