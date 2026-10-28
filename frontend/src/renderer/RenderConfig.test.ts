// ROLE: Unit tests for render-space conversion helpers.
import { describe, expect, it } from "vitest";
import { headGlowRadiusWorld } from "./RenderConfig";

describe("headGlowRadiusWorld", () => {
  it("converts glow cells to world units and adds the head radius", () => {
    expect(headGlowRadiusWorld(4, 3, 20)).toBe(64);
    expect(headGlowRadiusWorld(0, 0, 20)).toBe(0);
    expect(headGlowRadiusWorld(2, -1, 20)).toBe(2);
  });
});
