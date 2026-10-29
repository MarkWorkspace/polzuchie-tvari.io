// ROLE: Unit tests for render-space conversion helpers and render layers.
import { describe, expect, it } from "vitest";
import {
  BLOOM_MASK_LAYER,
  headGlowRadiusWorld,
  OVERLAY_LAYER,
  SNAKE_SHADOW_LAYER,
} from "./RenderConfig";

describe("headGlowRadiusWorld", () => {
  it("converts glow cells to world units and adds the head radius", () => {
    expect(headGlowRadiusWorld(4, 3, 20)).toBe(64);
    expect(headGlowRadiusWorld(0, 0, 20)).toBe(0);
    expect(headGlowRadiusWorld(2, -1, 20)).toBe(2);
  });
});

describe("render layers", () => {
  it("keeps the mask layers inside the valid three.js range", () => {
    for (const layer of [BLOOM_MASK_LAYER, SNAKE_SHADOW_LAYER]) {
      expect(layer).toBeGreaterThanOrEqual(0);
      expect(layer).toBeLessThanOrEqual(31);
    }
  });

  it("keeps every mask pass on its own layer", () => {
    // Sharing layers would make one pass rasterize the wrong objects: the
    // overlay layer holds fog/glow sprites, the bloom mask holds every glow
    // object, the occlusion pass must see the ribbon alone.
    const layers = [OVERLAY_LAYER, BLOOM_MASK_LAYER, SNAKE_SHADOW_LAYER];
    expect(new Set(layers).size).toBe(layers.length);
  });
});
