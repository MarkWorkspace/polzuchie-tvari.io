// ROLE: Parity-тест тороидальной математики. Сверяет TS-реализацию с golden vectors из tests_shared/.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toroidalDelta, toroidalDistance } from "./MathUtils";

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
}

const VECTORS_PATH = resolve(
  __dirname,
  "../../../../tests_shared/golden_vectors/math.json"
);
const ABS_TOL = 1e-6;

function loadVectors(): MathVector[] {
  return JSON.parse(readFileSync(VECTORS_PATH, "utf-8"));
}

describe("Toroidal math parity (golden vectors)", () => {
  const vectors = loadVectors();

  describe("toroidalDelta", () => {
    vectors.forEach((v, i) => {
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const [dx, dy] = toroidalDelta(
          v.x1, v.y1, v.x2, v.y2, v.width, v.height
        );
        expect(Math.abs(dx - v.expected_delta[0])).toBeLessThan(ABS_TOL);
        expect(Math.abs(dy - v.expected_delta[1])).toBeLessThan(ABS_TOL);
      });
    });
  });

  describe("toroidalDistance", () => {
    vectors.forEach((v, i) => {
      it(`#${i}: ${v.desc ?? ""}`, () => {
        const dist = toroidalDistance(
          v.x1, v.y1, v.x2, v.y2, v.width, v.height
        );
        expect(Math.abs(dist - v.expected_distance)).toBeLessThan(ABS_TOL);
      });
    });
  });
});
