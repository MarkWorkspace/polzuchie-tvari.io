// ROLE: Unit tests for render-space conversion helpers and render layers.
import { describe, expect, it } from "vitest";
import { BLOOM_MASK_LAYER, headGlowRadiusWorld, OVERLAY_LAYER } from "./RenderConfig";

describe("headGlowRadiusWorld", () => {
  it("converts glow cells to world units and adds the head radius", () => {
    expect(headGlowRadiusWorld(4, 3, 20)).toBe(64);
    expect(headGlowRadiusWorld(0, 0, 20)).toBe(0);
    expect(headGlowRadiusWorld(2, -1, 20)).toBe(2);
  });
});

describe("render layers", () => {
  it("keeps the bloom mask layer inside the valid three.js range", () => {
    expect(BLOOM_MASK_LAYER).toBeGreaterThanOrEqual(0);
    expect(BLOOM_MASK_LAYER).toBeLessThanOrEqual(31);
  });

  it("does not share the overlay layer", () => {
    // Sharing would make the mask pass rasterize the fog/glow sprites.
    expect(BLOOM_MASK_LAYER).not.toBe(OVERLAY_LAYER);
  });
});
