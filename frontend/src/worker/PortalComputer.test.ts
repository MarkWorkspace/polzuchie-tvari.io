// ROLE: Regression tests that portal instance centers use the shared grid-to-world mapping.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { computePortals } from "./PortalComputer";
import { gridToWorldX, gridToWorldY } from "./shared/WorldMath";

const GRID_SIZE = 20;

function portalState(): GameState {
  return {
    server_world: { width: 100, height: 100, portals_enabled: 1 },
    players: {},
    portals: [
      {
        id: 1,
        x1: 2.25,
        y1: 3.5,
        x2: 8.75,
        y2: 9.25,
        radius: 0.5,
        current_scale: 1.0,
        color: "#38bdf8",
      },
    ],
  } as unknown as GameState;
}

describe("computePortals world coordinates", () => {
  it("places both portal ends at gridToWorld centers, not at the half-cell-offset origin", () => {
    const buffers = computePortals(
      portalState(),
      null,
      1,
      0,
      0,
      1000,
      GRID_SIZE,
      true,
      () => 0,
      0,
      0,
      0,
    );

    expect(buffers.portalCount).toBe(2);
    expect(buffers.portalDiskMatrices[12]).toBeCloseTo(gridToWorldX(2.25, GRID_SIZE), 5);
    expect(buffers.portalDiskMatrices[13]).toBeCloseTo(gridToWorldY(3.5, GRID_SIZE), 5);
    expect(buffers.portalRingMatrices[28]).toBeCloseTo(gridToWorldX(8.75, GRID_SIZE), 5);
    expect(buffers.portalRingMatrices[29]).toBeCloseTo(gridToWorldY(9.25, GRID_SIZE), 5);

    expect(buffers.portalDiskMatrices[12]).not.toBe(2.25 * GRID_SIZE);
    expect(buffers.portalDiskMatrices[13]).not.toBe(-3.5 * GRID_SIZE);
  });
});
