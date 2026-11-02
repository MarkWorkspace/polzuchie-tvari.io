// ROLE: Unit tests for the single grid↔world conversion helper. No toroidal wrap.
import { describe, expect, it } from "vitest";
import {
  gridToWorldX,
  gridToWorldY,
  worldSizeFromGrid,
  worldToGridX,
  worldToGridY,
} from "./WorldMath";

const GRID_SIZE = 20;

describe("WorldMath", () => {
  it("maps known grid points to cell centers", () => {
    expect(gridToWorldX(0, GRID_SIZE)).toBe(10);
    expect(gridToWorldY(0, GRID_SIZE)).toBe(-10);
    expect(gridToWorldX(1, GRID_SIZE)).toBe(30);
    expect(gridToWorldY(1, GRID_SIZE)).toBe(-30);
    expect(gridToWorldX(9.5, GRID_SIZE)).toBe(200);
    expect(gridToWorldY(7.25, GRID_SIZE)).toBe(-155);
  });

  it("round-trips continuous grid coordinates through world space", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1.25, y: 9.75 },
      { x: 49.5, y: 12.125 },
      { x: 99.999, y: 0.001 },
    ];

    for (const point of points) {
      const wx = gridToWorldX(point.x, GRID_SIZE);
      const wy = gridToWorldY(point.y, GRID_SIZE);

      expect(worldToGridX(wx, GRID_SIZE)).toBeCloseTo(point.x, 10);
      expect(worldToGridY(wy, GRID_SIZE)).toBeCloseTo(point.y, 10);
    }
  });

  it("keeps the map seam on the half-cell boundary", () => {
    const mapWidth = 100;
    const worldWidth = worldSizeFromGrid(mapWidth, GRID_SIZE);

    expect(worldWidth).toBe(2000);
    expect(gridToWorldX(0, GRID_SIZE) - GRID_SIZE / 2).toBe(0);
    expect(gridToWorldX(mapWidth, GRID_SIZE) - GRID_SIZE / 2).toBe(worldWidth);
    expect(worldToGridX(0, GRID_SIZE)).toBe(-0.5);
    expect(worldToGridX(worldWidth, GRID_SIZE)).toBe(mapWidth - 0.5);
  });

  it("does not add a half-cell to sizes", () => {
    expect(worldSizeFromGrid(1, GRID_SIZE)).toBe(GRID_SIZE);
    expect(worldSizeFromGrid(0, GRID_SIZE)).toBe(0);
  });
});
