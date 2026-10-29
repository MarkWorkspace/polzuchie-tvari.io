// ROLE: Unit tests for the bloom mask target sizing.
import { describe, expect, it } from "vitest";
import { BLOOM_MASK_SCALE, bloomMaskSize } from "./BloomMaskRenderer";

describe("bloomMaskSize", () => {
  it("renders the mask at a fraction of the drawing buffer", () => {
    const size = bloomMaskSize(1440, 900, 1);
    expect(size.width).toBe(1440 / BLOOM_MASK_SCALE);
    expect(size.height).toBe(900 / BLOOM_MASK_SCALE);
  });

  it("accounts for the device pixel ratio", () => {
    expect(bloomMaskSize(800, 600, 2)).toEqual({
      width: (800 * 2) / BLOOM_MASK_SCALE,
      height: (600 * 2) / BLOOM_MASK_SCALE,
    });
  });

  it("never produces an empty target", () => {
    const size = bloomMaskSize(1, 1, 0.1);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("falls back to a sane ratio when the renderer reports an invalid one", () => {
    expect(bloomMaskSize(400, 400, Number.NaN)).toEqual(bloomMaskSize(400, 400, 1));
    expect(bloomMaskSize(400, 400, 0)).toEqual(bloomMaskSize(400, 400, 1));
    expect(bloomMaskSize(400, 400, -2)).toEqual(bloomMaskSize(400, 400, 1));
  });

  it("rounds to whole texels", () => {
    const size = bloomMaskSize(1441, 901, 1.5);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});
