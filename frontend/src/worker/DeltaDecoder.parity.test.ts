// ROLE: Parity-тест сетевого кадра. Декодирует бинарные фикстуры через DeltaDecoder и сравнивает с expected JSON.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeDeltaState, decodeFullState, decompress } from "./DeltaDecoder";
import { decodeGameStateFrame } from "./shared/ProtoFrameDecoder";

const FIXTURES_DIR = resolve(__dirname, "../../../tests_shared/golden_frames");

const MAP_W = 100;
const MAP_H = 100;

function loadBin(name: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(FIXTURES_DIR, name)));
}

function loadExpected(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), "utf-8"));
}

function decodeFixturePair(prefix: string) {
  const fullParsed = decodeGameStateFrame(decompress(loadBin(`${prefix}_full.bin`)));
  const fullState = decodeFullState(fullParsed, MAP_W, MAP_H);
  const deltaParsed = decodeGameStateFrame(decompress(loadBin(`${prefix}_delta.bin`)));
  const deltaState = decodeDeltaState(deltaParsed, fullState, MAP_W, MAP_H);
  const fullExpected = loadExpected(`${prefix}_full.expected.json`);
  const deltaExpected = loadExpected(`${prefix}_delta.expected.json`);
  return { fullParsed, fullState, deltaParsed, deltaState, fullExpected, deltaExpected };
}

describe("Frame parity (golden fixtures)", () => {
  it("decodes FULL frame and matches expected structure", () => {
    const compressed = loadBin("frame_full.bin");
    const decompressed = decompress(compressed);
    const parsed = decodeGameStateFrame(decompressed);
    const expected = loadExpected("frame_full.expected.json");

    const state = decodeFullState(parsed, MAP_W, MAP_H);

    const expPlayers = expected["players"] as Record<string, unknown>;
    expect(Object.keys(state.players).sort()).toEqual(Object.keys(expPlayers).sort());

    for (const pid of Object.keys(expPlayers)) {
      const sp = state.players[pid];
      const ep = expPlayers[pid] as Record<string, unknown>;

      expect(Array.isArray(sp.body)).toBe(true);
      const expBody = (ep["body"] as number[] | undefined) ?? [];
      const truncated = ep["body_truncated"] === true;
      const dead = ep["is_dead"] === true;
      if (dead) {
        // Dead players carry no drawable body but preserve final_length.
        expect(sp.is_dead).toBe(true);
        expect(sp.length).toBe(0);
        expect(sp.body).toEqual([]);
        expect(sp.final_length).toBe(ep["final_length"]);
        expect(sp.body_truncated).toBe(false);
      } else if (truncated) {
        // Out-of-AoI: decoder drops the single mini point but keeps the head
        // for the minimap.
        expect(sp.body_truncated).toBe(true);
        expect(sp.length).toBe(1);
        expect(sp.body).toEqual([]);
        expect(sp.head_x).toBeCloseTo(expBody[0], 2);
        expect(sp.head_y).toBeCloseTo(expBody[1], 2);
      } else {
        expect(sp.body_truncated).toBe(false);
        expect(sp.length).toBe(ep["length"]);
        expect(sp.body.length).toBe(expBody.length);
        for (let i = 0; i < expBody.length; i++) {
          expect(Math.abs(sp.body[i] - expBody[i])).toBeLessThan(0.01);
        }
        // Server bodies are head-first.
        expect(sp.body[0]).toBeCloseTo(expBody[0], 2);
        expect(sp.body[1]).toBeCloseTo(expBody[1], 2);
      }

      expect(sp.score ?? 0).toBe(ep["score"] ?? 0);
      expect(sp.kills ?? 0).toBe(ep["kills"] ?? 0);
      expect(sp.deaths ?? 0).toBe(ep["deaths"] ?? 0);
    }

    expect(state.foods.length).toBe((expected["foods"] as unknown[]).length);
    expect(state.portals).toBeDefined();
    expect(state.server_tick_rate).toBe(expected["server_tick_rate"]);
    // frame_seq/server_tick are distinct from server_tick_rate (field 2).
    expect(parsed.frame_seq).toBe(expected["frame_seq"]);
    expect(parsed.server_tick).toBe(expected["server_tick"]);
    expect(parsed.frame_seq).not.toBe(parsed.server_tick_rate);
  });

  it("decodes DELTA frame and matches expected structure", () => {
    const compressed = loadBin("frame_delta.bin");
    const decompressed = decompress(compressed);
    const parsed = decodeGameStateFrame(decompressed);
    const expected = loadExpected("frame_delta.expected.json");

    const fullCompressed = loadBin("frame_full.bin");
    const fullDecompressed = decompress(fullCompressed);
    const fullParsed = decodeGameStateFrame(fullDecompressed);
    const prevState = decodeFullState(fullParsed, MAP_W, MAP_H);

    const state = decodeDeltaState(parsed, prevState, MAP_W, MAP_H);

    const expPlayers = expected["players"] as Record<string, unknown>;
    expect(Object.keys(state.players).sort()).toEqual(Object.keys(expPlayers).sort());

    for (const pid of Object.keys(expPlayers)) {
      const sp = state.players[pid];
      const ep = expPlayers[pid] as Record<string, unknown>;
      const raw = parsed.players[pid];
      const expHeads = (ep["new_heads"] as number[] | undefined) ?? [];
      const expBody = (ep["body"] as number[] | undefined) ?? [];
      const truncated = ep["body_truncated"] === true;
      const dead = ep["is_dead"] === true;

      expect(sp.score ?? 0).toBe(ep["score"] ?? 0);
      expect(sp.kills ?? 0).toBe(ep["kills"] ?? 0);

      // Repeated fields are absent when empty; compare the wire payload to JSON.
      expect(raw.new_heads ?? []).toHaveLength(expHeads.length);
      for (let i = 0; i < expHeads.length; i++) {
        expect(Math.abs(raw.new_heads[i] - expHeads[i])).toBeLessThan(0.01);
      }
      expect(raw.body ?? []).toHaveLength(expBody.length);

      if (dead) {
        expect(sp.is_dead).toBe(true);
        expect(sp.length).toBe(0);
        expect(sp.body).toEqual([]);
        expect(sp.final_length).toBe(ep["final_length"]);
        expect(sp.body_truncated).toBe(false);
        continue;
      }

      if (truncated) {
        expect(sp.body_truncated).toBe(true);
        expect(sp.length).toBe(1);
        expect(sp.body).toEqual([]);
        const head = expHeads.length > 0 ? expHeads : expBody;
        expect(sp.head_x).toBeCloseTo(head[0], 2);
        expect(sp.head_y).toBeCloseTo(head[1], 2);
      } else {
        expect(sp.body_truncated).toBe(false);
        expect(sp.length).toBe(ep["length"]);
        // In-AoI deltas send new heads (or a full body on AoI transition).
        expect(sp.body.length).toBe((ep["length"] as number) * 2);
        const head = expHeads.length > 0 ? expHeads : expBody;
        expect(sp.body[0]).toBeCloseTo(head[0], 2);
        expect(sp.body[1]).toBeCloseTo(head[1], 2);
      }
    }

    expect(state.server_tick_rate).toBe(expected["server_tick_rate"]);
    // The DELTA continues the FULL's tick sequence by exactly one tick.
    expect(parsed.frame_seq).toBe(expected["frame_seq"]);
    expect(parsed.server_tick).toBe(expected["server_tick"]);
    expect(parsed.frame_seq).toBe(fullParsed.frame_seq + 1);
  });

  it("clears the old body for a player that dies between FULL and DELTA", () => {
    const { fullState, deltaState, fullExpected, deltaExpected } = decodeFixturePair("frame");

    const expDead = (fullExpected["players"] as Record<string, any>).player_dead;
    const dead = fullState.players.player_dead;
    expect(dead.is_dead).toBe(true);
    expect(dead.length).toBe(0);
    expect(dead.body).toEqual([]);
    expect(dead.final_length).toBe(expDead.final_length);
    expect(dead.final_length).toBeGreaterThan(0);

    const before = fullState.players.player_dies;
    expect(before.is_dead).toBe(false);
    expect(before.body.length).toBeGreaterThan(0);

    const expDied = (deltaExpected["players"] as Record<string, any>).player_dies;
    const died = deltaState.players.player_dies;
    expect(died.is_dead).toBe(true);
    expect(died.length).toBe(0);
    expect(died.body).toEqual([]);
    expect(died.body_truncated).toBe(false);
    expect(died.final_length).toBe(expDied.final_length);
    expect(died.final_length).toBeGreaterThan(0);
  });

  it("decodes teleport state, exit position and timer from fixtures", () => {
    const { fullState, deltaState, fullExpected, deltaExpected } = decodeFixturePair("frame");

    const expFullTp = (fullExpected["players"] as Record<string, any>).player_teleport;
    const fullTp = fullState.players.player_teleport;
    expect(fullTp.teleport_state).toBe("in_transit");
    expect(fullTp.teleport_out_x).toBeCloseTo(70, 2);
    expect(fullTp.teleport_out_y).toBeCloseTo(70, 2);
    expect(fullTp.teleport_timer_ratio).toBeCloseTo(expFullTp.teleport_timer_ratio, 2);
    expect(fullTp.body.length).toBeGreaterThan(0);
    expect(fullTp.length).toBe(9);

    const expDeltaTp = (deltaExpected["players"] as Record<string, any>).player_teleport;
    const deltaTp = deltaState.players.player_teleport;
    expect(deltaTp.teleport_state).toBe("in_transit");
    expect(deltaTp.teleport_out_x).toBeCloseTo(70, 2);
    expect(deltaTp.teleport_out_y).toBeCloseTo(70, 2);
    expect(deltaTp.teleport_timer_ratio).toBeCloseTo(expDeltaTp.teleport_timer_ratio, 2);
    // In-transit DELTA collapses the body to the exit point for the minimap.
    expect(deltaTp.body_truncated).toBe(true);
    expect(deltaTp.body).toEqual([]);
    expect(deltaTp.length).toBe(1);
    expect(deltaTp.head_x).toBeCloseTo(70, 2);
    expect(deltaTp.head_y).toBeCloseTo(70, 2);
  });

  it("decodes out-of-AoI frames as a truncated body with a head", () => {
    const { fullState, deltaState, fullExpected, deltaExpected } = decodeFixturePair("frame");

    const expFullFar = (fullExpected["players"] as Record<string, any>).player_far;
    const fullFar = fullState.players.player_far;
    expect(fullFar.body_truncated).toBe(true);
    expect(fullFar.body).toEqual([]);
    expect(fullFar.length).toBe(1);
    expect(fullFar.head_x).toBeCloseTo(expFullFar.body[0], 2);
    expect(fullFar.head_y).toBeCloseTo(expFullFar.body[1], 2);

    const expDeltaFar = (deltaExpected["players"] as Record<string, any>).player_far;
    const deltaFar = deltaState.players.player_far;
    expect(deltaFar.body_truncated).toBe(true);
    expect(deltaFar.body).toEqual([]);
    expect(deltaFar.length).toBe(1);
    expect(deltaFar.head_x).toBeCloseTo(expDeltaFar.new_heads[0], 2);
    expect(deltaFar.head_y).toBeCloseTo(expDeltaFar.new_heads[1], 2);
  });

  it("decodes the empty scenario to empty players maps", () => {
    const { fullParsed, fullState, deltaParsed, deltaState, fullExpected, deltaExpected } =
      decodeFixturePair("frame_empty");

    expect(fullState.players).toEqual({});
    expect(deltaState.players).toEqual({});
    expect(fullParsed.players ?? {}).toEqual({});
    expect(deltaParsed.players ?? {}).toEqual({});
    expect(fullExpected["players"]).toBeUndefined();
    expect(deltaExpected["players"]).toBeUndefined();
    expect(fullParsed.frame_seq).toBe(fullExpected["frame_seq"]);
    expect(deltaParsed.frame_seq).toBe(deltaExpected["frame_seq"]);
    expect(deltaParsed.frame_seq).toBe((fullParsed.frame_seq as number) + 1);
  });

  it("carries deterministic frame_seq/server_tick for every fixture pair", () => {
    for (const prefix of ["frame", "frame_empty"]) {
      const { fullParsed, deltaParsed, fullExpected, deltaExpected } = decodeFixturePair(prefix);
      expect(fullParsed.frame_seq).toBe(fullExpected["frame_seq"]);
      expect(fullParsed.server_tick).toBe(fullExpected["server_tick"]);
      expect(deltaParsed.frame_seq).toBe(deltaExpected["frame_seq"]);
      expect(deltaParsed.server_tick).toBe(deltaExpected["server_tick"]);
      expect(fullParsed.frame_seq).toBe(fullParsed.server_tick);
      expect(deltaParsed.frame_seq).toBe(deltaParsed.server_tick);
      expect(deltaParsed.frame_seq).toBe((fullParsed.frame_seq as number) + 1);
    }
  });

  it("clears portals, black holes, and tombstones when they are undefined in the delta payload", () => {
    const prevState = {
      server_tick_rate: 30,
      players: {},
      foods: [],
      portals: [{ id: "p1" }],
      black_holes: [{ id: "bh1" }],
      tombstones: [{ id: "t1" }],
    } as any;

    const deltaPayload = {
      players: {},
      eaten_foods: [],
      moved_foods: [],
      new_foods: [],
    } as any;

    const state = decodeDeltaState(deltaPayload, prevState, MAP_W, MAP_H);
    expect(state.portals).toEqual([]);
    expect(state.black_holes).toEqual([]);
    expect(state.tombstones).toEqual([]);
  });
});

function makeState(players: Record<string, any> = {}): any {
  return {
    server_tick_rate: 30,
    players,
    foods: [],
    portals: [],
    black_holes: [],
    tombstones: [],
  };
}

function makeDelta(players: Record<string, any>): any {
  return { players, eaten_foods: [], moved_foods: [], new_foods: [] };
}

describe("DeltaDecoder body truth table", () => {
  it("clears the old body when the player is dead (length=0)", () => {
    const prev = makeState({
      ghost: { body: [5, 5, 4, 5], angle: 0, score: 0, kills: 0, deaths: 0 },
    });
    const state = decodeDeltaState(
      makeDelta({ ghost: { is_dead: true, length: 0 } }),
      prev,
      MAP_W,
      MAP_H,
    );

    expect(state.players.ghost.body).toEqual([]);
    expect(state.players.ghost.length).toBe(0);
    expect(state.players.ghost.body_truncated).toBe(false);
  });

  it("drops a truncated mini body but keeps the head for the minimap", () => {
    const deltaState = decodeDeltaState(
      makeDelta({
        far: { body: [], new_heads: [5.5, 6.5], length: 1, body_truncated: true },
      }),
      makeState(),
      MAP_W,
      MAP_H,
    );
    expect(deltaState.players.far.body).toEqual([]);
    expect(deltaState.players.far.length).toBe(1);
    expect(deltaState.players.far.body_truncated).toBe(true);
    expect(deltaState.players.far.head_x).toBeCloseTo(5.5, 2);
    expect(deltaState.players.far.head_y).toBeCloseTo(6.5, 2);

    const fullState = decodeFullState(
      { players: { far: { body: [5.5, 6.5], length: 1, body_truncated: true } } } as any,
      MAP_W,
      MAP_H,
    );
    expect(fullState.players.far.body).toEqual([]);
    expect(fullState.players.far.body_truncated).toBe(true);
    expect(fullState.players.far.head_x).toBeCloseTo(5.5, 2);
    expect(fullState.players.far.head_y).toBeCloseTo(6.5, 2);
  });

  it("keeps the new head when an in-AoI player has no old body", () => {
    const state = decodeDeltaState(
      makeDelta({ fresh: { body: [], new_heads: [7, 8], length: 5 } }),
      makeState(),
      MAP_W,
      MAP_H,
    );

    expect(state.players.fresh.body).toEqual([7, 8]);
    expect(state.players.fresh.length).toBe(5);
    expect(state.players.fresh.head_x).toBe(7);
    expect(state.players.fresh.head_y).toBe(8);
  });

  it("treats length=1 without body_truncated as a real one-segment snake", () => {
    const fullState = decodeFullState(
      { players: { tiny: { body: [3.25, 4.5], length: 1 } } } as any,
      MAP_W,
      MAP_H,
    );
    expect(fullState.players.tiny.body).toEqual([3.25, 4.5]);
    expect(fullState.players.tiny.body_truncated).toBe(false);

    const prev = makeState({
      tiny: { body: [2, 3], angle: 0, score: 0, kills: 0, deaths: 0 },
    });
    const deltaState = decodeDeltaState(
      makeDelta({ tiny: { body: [], new_heads: [3.25, 4.5], length: 1 } }),
      prev,
      MAP_W,
      MAP_H,
    );
    expect(deltaState.players.tiny.body).toEqual([3.25, 4.5]);
  });

  it("reconstructs delta bodies with the new head first", () => {
    const prev = makeState({
      snake: { body: [10, 10, 9, 10], angle: 0, score: 0, kills: 0, deaths: 0 },
    });
    const state = decodeDeltaState(
      makeDelta({ snake: { body: [], new_heads: [11, 10], length: 2 } }),
      prev,
      MAP_W,
      MAP_H,
    );

    expect(state.players.snake.body).toEqual([11, 10, 10, 10]);
    expect(state.players.snake.head_x).toBe(11);
    expect(state.players.snake.head_y).toBe(10);
  });

  it("decodes final_length for dead FULL and DELTA frames", () => {
    const full = decodeFullState(
      {
        players: {
          ghost: { is_dead: true, length: 0, final_length: 23 },
        },
      } as any,
      MAP_W,
      MAP_H,
    );
    expect(full.players.ghost.is_dead).toBe(true);
    expect(full.players.ghost.length).toBe(0);
    expect(full.players.ghost.body).toEqual([]);
    expect(full.players.ghost.final_length).toBe(23);

    const prev = makeState({
      ghost: { body: [5, 5, 4, 5], angle: 0, score: 0, kills: 0, deaths: 0 },
    });
    const delta = decodeDeltaState(
      makeDelta({ ghost: { is_dead: true, length: 0, final_length: 17 } }),
      prev,
      MAP_W,
      MAP_H,
    );
    expect(delta.players.ghost.is_dead).toBe(true);
    expect(delta.players.ghost.length).toBe(0);
    expect(delta.players.ghost.body).toEqual([]);
    expect(delta.players.ghost.final_length).toBe(17);
  });

  it("keeps alive length and does not invent final_length", () => {
    const state = decodeFullState(
      {
        players: {
          alive: { body: [1, 2, 0, 2, -1, 2, -2, 2], length: 4 },
        },
      } as any,
      MAP_W,
      MAP_H,
    );
    expect(state.players.alive.is_dead).toBe(false);
    expect(state.players.alive.length).toBe(4);
    expect(state.players.alive.body).toEqual([1, 2, 0, 2, -1, 2, -2, 2]);
    expect(state.players.alive.final_length).toBeUndefined();
  });

  it("does not leave undefined holes when a delta outruns a one-segment body", () => {
    // First delta leaves the player with a real one-segment body.
    const afterTiny = decodeDeltaState(
      makeDelta({ tiny: { body: [], new_heads: [10, 10], length: 1 } }),
      makeState({
        tiny: { body: [9, 10, 8, 10], angle: 0, score: 0, kills: 0, deaths: 0 },
      }),
      MAP_W,
      MAP_H,
    );
    expect(afterTiny.players.tiny.body).toEqual([10, 10]);

    // A later delta claims more length than old tail + new heads can supply.
    const afterJump = decodeDeltaState(
      makeDelta({ tiny: { body: [], new_heads: [11, 10], length: 5 } }),
      afterTiny,
      MAP_W,
      MAP_H,
    );
    const body = afterJump.players.tiny.body;
    expect(body).toEqual([11, 10, 10, 10]);
    expect(body.length % 2).toBe(0);
    expect(body.every((v) => typeof v === "number" && Number.isFinite(v))).toBe(true);
    expect(body.some((v) => Number.isNaN(v))).toBe(false);
  });
});

describe("ProtoFrameDecoder Player.final_length", () => {
  it("maps field 16 to final_length in the player payload", () => {
    const playerBytes = [0x80, 0x01, 23]; // field 16 (varint), value 23
    const key = Array.from(new TextEncoder().encode("ghost"));
    const entry = [0x0a, key.length, ...key, 0x12, playerBytes.length, ...playerBytes];
    const frameBytes = Uint8Array.from([0x1a, entry.length, ...entry]);

    const parsed = decodeGameStateFrame(frameBytes);
    expect(parsed.players.ghost.final_length).toBe(23);
  });
});
