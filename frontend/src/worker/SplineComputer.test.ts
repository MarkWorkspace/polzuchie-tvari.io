// ROLE: Regression tests for spline allocation-free hot path: density, world coords,
// portal splits, toroidal unwrap, self visual offset and result independence.
import { describe, expect, it } from "vitest";
import type { Player } from "../types/game";
import { computeSplinePaths } from "./SplineComputer";

const GRID_SIZE = 20;
const MAP_W = 100;
const MAP_H = 100;

function makePlayer(body: number[]): Player {
  return { body, angle: 0, score: 0, kills: 0, deaths: 0 };
}

function computeSpline(
  body: number[],
  options: {
    oldBody?: number[] | null;
    progress?: number;
    visualX?: number;
    visualY?: number;
    isSelf?: boolean;
  } = {},
) {
  const oldBody = options.oldBody ?? null;
  return computeSplinePaths(
    makePlayer(body),
    oldBody ? makePlayer(oldBody) : null,
    options.progress ?? 1,
    MAP_W,
    MAP_H,
    options.visualX ?? 0,
    options.visualY ?? 0,
    options.isSelf ?? false,
    GRID_SIZE,
  );
}

describe("computeSplinePaths", () => {
  it("builds a density-2 spline in world coordinates with unit perpendicular normals", () => {
    const paths = computeSpline([10, 10, 11, 10, 12, 10, 13, 10]);
    expect(paths).toHaveLength(1);

    const path = paths[0];
    expect(path.pointsCount).toBe(7);
    expect(path.x).toHaveLength(7);
    expect(path.y).toHaveLength(7);
    expect(path.uvY).toHaveLength(7);
    expect(path.nx).toHaveLength(7);
    expect(path.ny).toHaveLength(7);

    const expectedX = [210, 220, 230, 240, 250, 260, 270];
    const expectedUvY = [0, 10, 20, 30, 40, 50, 60];
    for (let i = 0; i < path.pointsCount; i++) {
      expect(path.x[i]).toBeCloseTo(expectedX[i], 5);
      expect(path.y[i]).toBeCloseTo(-210, 5);
      expect(path.uvY[i]).toBeCloseTo(expectedUvY[i], 5);
    }

    for (let i = 0; i < path.pointsCount; i++) {
      expect(Math.hypot(path.nx[i], path.ny[i])).toBeCloseTo(1, 5);
      expect(path.nx[i]).toBeCloseTo(0, 5);
      expect(path.ny[i]).toBeCloseTo(1, 5);

      const prev = i === 0 ? 0 : i - 1;
      const next = i === path.pointsCount - 1 ? i : i + 1;
      const tangentX = path.x[next] - path.x[prev];
      const tangentY = path.y[next] - path.y[prev];
      expect(path.nx[i] * tangentX + path.ny[i] * tangentY).toBeCloseTo(0, 4);
    }
  });

  it("uses density 2 at exactly 20 segments and density 1 at 21 segments", () => {
    const body20: number[] = [];
    for (let i = 0; i < 20; i++) body20.push(10 + i, 10);
    const [path20] = computeSpline(body20);
    expect(path20.pointsCount).toBe(39);

    const body21: number[] = [];
    for (let i = 0; i < 21; i++) body21.push(10 + i, 10);
    const [path21] = computeSpline(body21);
    expect(path21.pointsCount).toBe(21);
    expect(path21.x).toHaveLength(21);
    expect(path21.y).toHaveLength(21);
  });

  it("interpolates old and new body points at progress 0.5", () => {
    const paths = computeSpline([11, 10, 12, 10], {
      oldBody: [10, 10, 11, 10],
      progress: 0.5,
    });
    expect(paths).toHaveLength(1);

    const path = paths[0];
    expect(path.pointsCount).toBe(3);
    expect(path.x[0]).toBeCloseTo(220, 5);
    expect(path.x[1]).toBeCloseTo(230, 5);
    expect(path.x[2]).toBeCloseTo(240, 5);
    expect(path.y[0]).toBeCloseTo(-210, 5);
  });

  it("uses old positions at progress 0 and new positions at progress 1", () => {
    const atStart = computeSpline([11, 10, 12, 10], {
      oldBody: [10, 10, 11, 10],
      progress: 0,
    });
    expect(Array.from(atStart[0].x)).toEqual([210, 220, 230]);

    const atEnd = computeSpline([11, 10, 12, 10], {
      oldBody: [10, 10, 11, 10],
      progress: 1,
    });
    expect(Array.from(atEnd[0].x)).toEqual([230, 240, 250]);
  });

  it("clamps to the last old point when oldBody is shorter than the current body", () => {
    const paths = computeSpline([10, 10, 11, 10, 12, 10], {
      oldBody: [10, 10, 11, 10],
      progress: 0.5,
    });
    const path = paths[0];

    expect(path.pointsCount).toBe(5);
    expect(path.x[4]).toBeCloseTo(240, 5);
  });

  it("ignores extra old points when oldBody is longer than the current body", () => {
    const paths = computeSpline([10, 10, 11, 10], {
      oldBody: [10, 10, 11, 10, 12, 10],
      progress: 0.5,
    });
    const path = paths[0];

    expect(path.pointsCount).toBe(3);
    expect(Array.from(path.x)).toEqual([210, 220, 230]);
  });

  it("does not interpolate across a jump larger than 6 grid units", () => {
    const paths = computeSpline([20, 10, 21, 10], {
      oldBody: [10, 10, 11, 10],
      progress: 0.5,
    });
    const path = paths[0];

    expect(path.pointsCount).toBe(3);
    expect(path.x[0]).toBeCloseTo(410, 5);
    expect(path.x[2]).toBeCloseTo(430, 5);
  });

  it("splits a portal-sized jump into two subpaths, head first", () => {
    const paths = computeSpline([10, 10, 11, 10, 50, 50, 51, 50]);
    expect(paths).toHaveLength(2);

    expect(paths[0].pointsCount).toBe(3);
    expect(paths[0].x[0]).toBeCloseTo(210, 5);
    expect(paths[0].x[2]).toBeCloseTo(230, 5);
    expect(paths[0].y[0]).toBeCloseTo(-210, 5);
    expect(paths[0].y[2]).toBeCloseTo(-210, 5);

    expect(paths[1].pointsCount).toBe(3);
    expect(paths[1].x[0]).toBeCloseTo(1010, 5);
    expect(paths[1].x[2]).toBeCloseTo(1030, 5);
    expect(paths[1].y[0]).toBeCloseTo(-1010, 5);
    expect(paths[1].y[2]).toBeCloseTo(-1010, 5);

    expect(paths[0].x.buffer).not.toBe(paths[1].x.buffer);
  });

  it("unwraps a map border crossing without a false split", () => {
    const paths = computeSpline([99, 10, 0, 10, 1, 10]);
    expect(paths).toHaveLength(1);

    const path = paths[0];
    expect(path.pointsCount).toBe(5);
    expect(path.x[0]).toBeCloseTo(1990, 5);
    expect(path.x[1]).toBeCloseTo(2000, 5);
    expect(path.x[2]).toBeCloseTo(2010, 5);
    expect(path.x[3]).toBeCloseTo(2020, 5);
    expect(path.x[4]).toBeCloseTo(2030, 5);
  });

  it("applies the self visual offset and wraps it into the map", () => {
    const paths = computeSpline([1, 1, 99, 1], {
      visualX: 5,
      visualY: -5,
      isSelf: true,
    });
    expect(paths).toHaveLength(1);

    const path = paths[0];
    expect(path.pointsCount).toBe(3);
    expect(path.x[0]).toBeCloseTo(130, 5);
    expect(path.x[1]).toBeCloseTo(110, 5);
    expect(path.x[2]).toBeCloseTo(90, 5);
    expect(path.y[0]).toBeCloseTo(-1930, 5);
    expect(path.y[2]).toBeCloseTo(-1930, 5);
  });

  it("does not let three later calls overwrite previous results", () => {
    const first = computeSpline([10, 10, 11, 10, 12, 10]);
    const firstPath = first[0];
    const firstX = Array.from(firstPath.x);
    const firstY = Array.from(firstPath.y);
    const firstUvY = Array.from(firstPath.uvY);
    const firstNx = Array.from(firstPath.nx);
    const firstNy = Array.from(firstPath.ny);

    const second = computeSpline([20, 20, 21, 20, 22, 20, 23, 20]);
    const secondPath = second[0];
    const secondX = Array.from(secondPath.x);
    const secondY = Array.from(secondPath.y);
    const secondUvY = Array.from(secondPath.uvY);
    const secondNx = Array.from(secondPath.nx);
    const secondNy = Array.from(secondPath.ny);

    const third = computeSpline([30, 30, 31, 30]);
    expect(third).toHaveLength(1);
    expect(third[0].pointsCount).toBe(3);
    expect(third[0].x.buffer).not.toBe(firstPath.x.buffer);
    expect(third[0].x.buffer).not.toBe(secondPath.x.buffer);

    expect(firstPath.pointsCount).toBe(5);
    expect(Array.from(firstPath.x)).toEqual(firstX);
    expect(Array.from(firstPath.y)).toEqual(firstY);
    expect(Array.from(firstPath.uvY)).toEqual(firstUvY);
    expect(Array.from(firstPath.nx)).toEqual(firstNx);
    expect(Array.from(firstPath.ny)).toEqual(firstNy);

    expect(secondPath.pointsCount).toBe(7);
    expect(Array.from(secondPath.x)).toEqual(secondX);
    expect(Array.from(secondPath.y)).toEqual(secondY);
    expect(Array.from(secondPath.uvY)).toEqual(secondUvY);
    expect(Array.from(secondPath.nx)).toEqual(secondNx);
    expect(Array.from(secondPath.ny)).toEqual(secondNy);
  });
});
