// ROLE: Unit tests for grass trample mask offset conversion. No WebGL.
import { describe, expect, it } from "vitest";
import { bodyMaskOffsetUv, GRASS_BODY_TRAMPLE_OFFSET_WORLD } from "./GrassRenderer";

describe("bodyMaskOffsetUv", () => {
  it("converts a world-space trample offset into mask UV units", () => {
    expect(bodyMaskOffsetUv(4, 180)).toBeCloseTo(4 / 360, 10);
    expect(bodyMaskOffsetUv(4, 360)).toBeCloseTo(4 / 720, 10);
  });

  it("keeps the offset constant in world units when the mask box grows", () => {
    expect(bodyMaskOffsetUv(GRASS_BODY_TRAMPLE_OFFSET_WORLD, 180) * 360).toBeCloseTo(
      GRASS_BODY_TRAMPLE_OFFSET_WORLD,
      10,
    );
    expect(bodyMaskOffsetUv(GRASS_BODY_TRAMPLE_OFFSET_WORLD, 600) * 1200).toBeCloseTo(
      GRASS_BODY_TRAMPLE_OFFSET_WORLD,
      10,
    );
  });

  it("clamps invalid input instead of producing NaN", () => {
    expect(bodyMaskOffsetUv(-1, 180)).toBe(0);
    expect(bodyMaskOffsetUv(Number.NaN, Number.NaN)).toBe(0);
    expect(Number.isFinite(bodyMaskOffsetUv(4, 0))).toBe(true);
  });
});
