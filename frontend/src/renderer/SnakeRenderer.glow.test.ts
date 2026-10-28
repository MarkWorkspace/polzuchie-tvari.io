// ROLE: Unit tests for head-only glow placement (bloom draws the body glow).
import { describe, expect, it } from "vitest";
import { gridSize } from "../game/Config";
import { headGlowRadiusWorld } from "./RenderConfig";
import { headGlowPlacements } from "./SnakeRenderer";

describe("headGlowPlacements", () => {
  it("emits exactly one sprite per visible head", () => {
    const placements = headGlowPlacements(
      [
        { hx: 10, hy: 20, radius: 1.5, glowColor: 0x22c55e },
        { hx: 30, hy: 40, radius: 1, glowColor: 0xef4444 },
        { hx: 50, hy: 60, radius: 1, glowColor: 0x3b82f6 },
      ],
      3,
    );

    // Body glow comes from bloom along the ribbon; extra sprites per segment
    // would regress to the old ellipse/dot look.
    expect(placements).toHaveLength(3);
    expect(placements.map((p) => [p.x, p.y])).toEqual([
      [10, 20],
      [30, 40],
      [50, 60],
    ]);
  });

  it("uses the configured head glow radius and skin color", () => {
    const [placement] = headGlowPlacements([{ hx: 1, hy: 2, radius: 1.5, glowColor: 0x22c55e }], 4);

    expect(placement.radius).toBe(headGlowRadiusWorld(1.5 * gridSize, 4, gridSize));
    expect(placement.color).toBe(0x22c55e);
  });

  it("skips players without a head position and falls back to the default color", () => {
    const placements = headGlowPlacements(
      [{}, { hx: 5, hy: 6 }, { hx: 7, hy: 8, glowColor: 0 }],
      3,
    );

    expect(placements.map((p) => [p.x, p.y, p.color])).toEqual([
      [5, 6, 0xffa64d],
      [7, 8, 0],
    ]);
  });

  it("emits nothing when the head glow radius is disabled", () => {
    expect(headGlowPlacements([{ hx: 1, hy: 2 }], 0)).toEqual([]);
  });

  it("caps the instance count", () => {
    const players = Array.from({ length: 10 }, (_, i) => ({ hx: i, hy: i }));
    expect(headGlowPlacements(players, 3, 4)).toHaveLength(4);
  });
});
