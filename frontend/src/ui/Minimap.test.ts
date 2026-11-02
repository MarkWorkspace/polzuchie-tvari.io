// ROLE: Regression tests for minimap throttling, food cap and lightweight player data.
import { describe, expect, it } from "vitest";
import {
  capMinimapFoodCount,
  getPlayerDotColor,
  getPlayerHead,
  MAX_MINIMAP_FOODS,
  MINIMAP_UPDATE_INTERVAL_MS,
  shouldUpdateMinimap,
} from "./Minimap";

describe("shouldUpdateMinimap", () => {
  it("draws the first frame even before the interval elapsed", () => {
    expect(shouldUpdateMinimap(Number.NEGATIVE_INFINITY, 0)).toBe(true);
    expect(shouldUpdateMinimap(Number.NaN, 0)).toBe(true);
  });

  it("throttles updates inside the interval and allows them after it", () => {
    const lastDrawAt = 1000;
    expect(shouldUpdateMinimap(lastDrawAt, lastDrawAt + MINIMAP_UPDATE_INTERVAL_MS - 1)).toBe(
      false,
    );
    expect(shouldUpdateMinimap(lastDrawAt, lastDrawAt + MINIMAP_UPDATE_INTERVAL_MS)).toBe(true);
  });

  it("honours an explicit interval", () => {
    expect(shouldUpdateMinimap(500, 520, 10)).toBe(true);
    expect(shouldUpdateMinimap(500, 520, 30)).toBe(false);
  });
});

describe("capMinimapFoodCount", () => {
  it("keeps the food count below the cap", () => {
    expect(capMinimapFoodCount(42)).toBe(42);
    expect(capMinimapFoodCount(0)).toBe(0);
    expect(capMinimapFoodCount(-3)).toBe(0);
    expect(capMinimapFoodCount(Number.NaN)).toBe(0);
  });

  it("truncates fractional and oversized counts", () => {
    expect(capMinimapFoodCount(12.9)).toBe(12);
    expect(capMinimapFoodCount(MAX_MINIMAP_FOODS + 500)).toBe(MAX_MINIMAP_FOODS);
    expect(MAX_MINIMAP_FOODS).toBe(300);
  });
});

describe("Minimap player helpers", () => {
  it("reads the lightweight head_x/head_y payload", () => {
    expect(getPlayerHead({ head_x: 12.5, head_y: 7.25, body_len: 9 })).toEqual({
      x: 12.5,
      y: 7.25,
    });
  });

  it("still accepts the flat body payload", () => {
    expect(getPlayerHead({ body: [3, 4, 5, 6] })).toEqual({ x: 3, y: 4 });
  });

  it("no longer accepts the legacy object body payload", () => {
    expect(getPlayerHead({ body: [{ x: 3, y: 4 }] })).toBeNull();
    expect(getPlayerHead({ body: [3] })).toBeNull();
  });

  it("returns null for a missing body", () => {
    expect(getPlayerHead({})).toBeNull();
    expect(getPlayerHead(null)).toBeNull();
  });

  it("never passes a pattern skin name to the canvas fillStyle", () => {
    expect(getPlayerDotColor("rainbow")).toBe("#22c55e");
    expect(getPlayerDotColor("#ef4444")).toBe("#ef4444");
    expect(getPlayerDotColor("zebra")).toBe("#e2e8f0");
  });
});
