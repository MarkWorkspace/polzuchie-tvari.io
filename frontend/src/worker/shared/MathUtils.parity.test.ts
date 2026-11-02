// ROLE: Parity-тест тороидальной математики. Сверяет TS-реализацию с golden vectors из tests_shared/,
// включая wrapNearest/wrapDelta и tie-case на ровно половине периода.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toroidalDelta, toroidalDistance, wrapDelta, wrapNearest } from "./MathUtils";

interface MathVector {
  desc?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  expected_delta: [number, number];
  expected_distance: number;
  expected_wrap_delta?: [number, number];
  expected_wrap_nearest?: [number, number];
}

const VECTORS_PATH = resolve(__dirname, "../../../../tests_shared/golden_vectors/math.json");
const ABS_TOL = 1e-6;

function loadVectors(): MathVector[] {
  return JSON.parse(readFileSync(VECTORS_PATH, "utf-8"));
}

describe("Toroidal math parity (golden vectors)", () => {
  const vectors = loadVectors();

  describe("toroidalDelta", () => {
    vectors.forEach((v, i) => {
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const [dx, dy] = toroidalDelta(v.x1, v.y1, v.x2, v.y2, v.width, v.height);
        expect(Math.abs(dx - v.expected_delta[0])).toBeLessThan(ABS_TOL);
        expect(Math.abs(dy - v.expected_delta[1])).toBeLessThan(ABS_TOL);
      });
    });
  });

  describe("toroidalDistance", () => {
    vectors.forEach((v, i) => {
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const dist = toroidalDistance(v.x1, v.y1, v.x2, v.y2, v.width, v.height);
        expect(Math.abs(dist - v.expected_distance)).toBeLessThan(ABS_TOL);
      });
    });
  });

  describe("wrapDelta", () => {
    const wrapVectors = vectors.filter((v) => v.expected_wrap_delta !== undefined);

    wrapVectors.forEach((v) => {
      const i = vectors.indexOf(v);
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const [dx, dy] = v.expected_wrap_delta as [number, number];
        expect(Math.abs(wrapDelta(v.x2 - v.x1, v.width) - dx)).toBeLessThan(ABS_TOL);
        expect(Math.abs(wrapDelta(v.y2 - v.y1, v.height) - dy)).toBeLessThan(ABS_TOL);
      });
    });
  });

  describe("wrapNearest", () => {
    const wrapVectors = vectors.filter((v) => v.expected_wrap_nearest !== undefined);

    wrapVectors.forEach((v) => {
      const i = vectors.indexOf(v);
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const [wx, wy] = v.expected_wrap_nearest as [number, number];
        expect(Math.abs(wrapNearest(v.x2, v.width) - wx)).toBeLessThan(ABS_TOL);
        expect(Math.abs(wrapNearest(v.y2, v.height) - wy)).toBeLessThan(ABS_TOL);
      });
    });
  });
});

describe("wrapNearest", () => {
  it("wraps negative and over-map coordinates into [0, size)", () => {
    expect(wrapNearest(-1, 1000)).toBe(999);
    expect(wrapNearest(1250, 1000)).toBe(250);
    expect(wrapNearest(1000, 1000)).toBe(0);
    expect(wrapNearest(-0, 1000)).toBe(0);
  });

  it("returns the value unchanged for invalid sizes or non-finite values", () => {
    expect(wrapNearest(5, 0)).toBe(5);
    expect(wrapNearest(5, -10)).toBe(5);
    expect(wrapNearest(5, Number.POSITIVE_INFINITY)).toBe(5);
    expect(wrapNearest(Number.NaN, 1000)).toBeNaN();
    expect(wrapNearest(Number.POSITIVE_INFINITY, 1000)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("wrapDelta", () => {
  it("keeps the sign on exact half-size ties", () => {
    expect(wrapDelta(500, 1000)).toBe(500);
    expect(wrapDelta(-500, 1000)).toBe(-500);
    expect(toroidalDelta(0, 0, 500, 0, 1000, 1000)[0]).toBe(500);
    expect(toroidalDelta(500, 0, 0, 0, 1000, 1000)[0]).toBe(-500);
  });

  it("wraps just past half to the short path", () => {
    expect(wrapDelta(501, 1000)).toBe(-499);
    expect(wrapDelta(-501, 1000)).toBe(499);
  });

  it("normalizes deltas larger than one period", () => {
    expect(wrapDelta(2500, 1000)).toBe(500);
    expect(wrapDelta(-2500, 1000)).toBe(-500);
    expect(wrapDelta(2600, 1000)).toBe(-400);
  });

  it("returns the delta unchanged for invalid sizes and non-finite deltas", () => {
    expect(wrapDelta(123, 0)).toBe(123);
    expect(wrapDelta(123, -10)).toBe(123);
    expect(wrapDelta(123, Number.NaN)).toBe(123);
    expect(wrapDelta(Number.POSITIVE_INFINITY, 1000)).toBe(Number.POSITIVE_INFINITY);
  });
});
