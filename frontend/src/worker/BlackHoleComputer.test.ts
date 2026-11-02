// ROLE: Regression tests that black-hole instance centers use the shared grid-to-world mapping.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { computeBlackHoles } from "./BlackHoleComputer";
import { gridToWorldX, gridToWorldY } from "./shared/WorldMath";

const GRID_SIZE = 20;

function blackHoleState(): GameState {
  return {
    server_world: { width: 100, height: 100, black_holes_enabled: 1 },
    players: {},
    black_holes: [
      {
        id: "bh-1",
        x: 4.5,
        y: 6.25,
        pull_radius: 3,
        kill_radius: 0.5,
        current_scale: 1.0,
      },
    ],
  } as unknown as GameState;
}

describe("computeBlackHoles world coordinates", () => {
  it("places gravity, ring and core matrices at gridToWorld centers", () => {
    const buffers = computeBlackHoles(blackHoleState(), null, 1, 0, 0, 1000, GRID_SIZE, true);

    const expectedX = gridToWorldX(4.5, GRID_SIZE);
    const expectedY = gridToWorldY(6.25, GRID_SIZE);

    expect(buffers.blackHoleCount).toBe(1);
    for (const matrix of [
      buffers.blackHoleGravityMatrices,
      buffers.blackHoleRingMatrices,
      buffers.blackHoleCoreMatrices,
    ]) {
      expect(matrix[12]).toBeCloseTo(expectedX, 5);
      expect(matrix[13]).toBeCloseTo(expectedY, 5);
    }

    expect(buffers.blackHoleCoreMatrices[12]).not.toBe(4.5 * GRID_SIZE);
    expect(buffers.blackHoleCoreMatrices[13]).not.toBe(-6.25 * GRID_SIZE);
  });
});
