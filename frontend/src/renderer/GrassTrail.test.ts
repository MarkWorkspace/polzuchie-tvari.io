// ROLE: Tests for the fading grass trample trail buffer.
import { describe, expect, it } from "vitest";
import {
  GRASS_TRAIL_INTERVAL_MS,
  GRASS_TRAIL_LIFETIME_MS,
  GRASS_TRAIL_MAX_POINTS,
  GrassTrail,
  resolveGrassTrailPoint,
} from "./GrassTrail";

describe("GrassTrail", () => {
  it("records points at the sampling interval and fades older points", () => {
    const trail = new GrassTrail();
    const out = new Float32Array(GRASS_TRAIL_MAX_POINTS * 4);
    trail.update(0, 0, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS / 2, 10, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS + 1, 20, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS * 2 + 1, 30, 0);

    const count = trail.fill(GRASS_TRAIL_INTERVAL_MS * 2 + 1, out);
    expect(count).toBeGreaterThan(1);
    expect(out[2]).toBeLessThan(out[(count - 1) * 4 + 2]);
  });

  it("expires old points after the lifetime", () => {
    const trail = new GrassTrail();
    const out = new Float32Array(GRASS_TRAIL_MAX_POINTS * 4);
    trail.update(0, 0, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS, 10, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS * 2, 20, 0);
    trail.update(GRASS_TRAIL_LIFETIME_MS + 500, 30, 0);
    expect(trail.fill(GRASS_TRAIL_LIFETIME_MS + 500, out)).toBe(1);
  });

  it("keeps the trample visible for tens of seconds", () => {
    const trail = new GrassTrail();
    const out = new Float32Array(GRASS_TRAIL_MAX_POINTS * 4);
    trail.update(0, 0, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS, 10, 0);
    expect(trail.fill(30000, out)).toBe(2);
    expect(trail.fill(GRASS_TRAIL_LIFETIME_MS + 1, out)).toBe(0);
  });

  it("resets on a teleport and caps the buffer", () => {
    const trail = new GrassTrail();
    const out = new Float32Array(GRASS_TRAIL_MAX_POINTS * 4);
    trail.update(0, 0, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS, 10, 0);
    trail.update(GRASS_TRAIL_INTERVAL_MS * 2, 1000, 1000);
    expect(trail.fill(GRASS_TRAIL_INTERVAL_MS * 2, out)).toBe(1);

    for (let i = 0; i < GRASS_TRAIL_MAX_POINTS + 10; i++) {
      trail.update(GRASS_TRAIL_INTERVAL_MS * (3 + i), i * 4, 0);
    }
    expect(trail.fill(GRASS_TRAIL_INTERVAL_MS * 140, out)).toBeLessThanOrEqual(
      GRASS_TRAIL_MAX_POINTS,
    );
  });
});

describe("resolveGrassTrailPoint", () => {
  it("prefers the worker tail over the head", () => {
    const point = resolveGrassTrailPoint(
      {
        myId: "me",
        activePlayers: [
          { id: "other", isMe: false, tailX: 1, tailY: 2 },
          { id: "me", isMe: true, tailX: 10, tailY: 20 },
        ],
      },
      100,
      200,
    );
    expect(point).toEqual({ x: 10, y: 20 });
  });

  it("finds the local player by id when isMe is absent", () => {
    expect(
      resolveGrassTrailPoint(
        { myId: "me", activePlayers: [{ id: "me", tailX: 5, tailY: 6 }] },
        0,
        0,
      ),
    ).toEqual({ x: 5, y: 6 });
  });

  it("falls back to the head when the tail is missing or non-finite", () => {
    expect(
      resolveGrassTrailPoint({ myId: "me", activePlayers: [{ id: "me", isMe: true }] }, 3, 4),
    ).toEqual({ x: 3, y: 4 });
    expect(
      resolveGrassTrailPoint(
        { myId: "me", activePlayers: [{ id: "me", isMe: true, tailX: Number.NaN, tailY: 1 }] },
        3,
        4,
      ),
    ).toEqual({ x: 3, y: 4 });
    expect(resolveGrassTrailPoint({}, 3, 4)).toEqual({ x: 3, y: 4 });
  });
});
