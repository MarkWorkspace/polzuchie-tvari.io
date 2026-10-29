// ROLE: Tests for deterministic grass placement, toroidal wrap, culling and budget caps.
import { describe, expect, it } from "vitest";
import {
  createCellTufts,
  createGrassTuftBuffer,
  GRASS_SEED,
  type GrassFieldConfig,
  hashCell,
  placeGrassTufts,
  sampleCellTufts,
  toroidalDistance,
} from "./DecorField";
import {
  GRASS_MAX_CULL_RADIUS,
  GRASS_MIN_CULL_RADIUS,
  grassCullRadius,
  grassLodScale,
} from "./GrassRenderer";

const config: GrassFieldConfig = {
  seed: GRASS_SEED,
  gridSize: 20,
  mapCellsX: 100,
  mapCellsY: 100,
  density: 0.6,
};

const denseConfig: GrassFieldConfig = { ...config, density: 1 };
const worldWidth = config.mapCellsX * config.gridSize;
const worldHeight = config.mapCellsY * config.gridSize;

function readCell(cellX: number, cellY: number, cfg = denseConfig) {
  const out = createCellTufts();
  const count = sampleCellTufts(cellX, cellY, cfg, out);
  return {
    count,
    x: Array.from(out.x),
    y: Array.from(out.y),
    yaw: Array.from(out.yaw),
    scale: Array.from(out.scale),
    colorMix: Array.from(out.colorMix),
  };
}

function collect(camX: number, camY: number, radius: number, budget: number, cfg = config) {
  const buffer = createGrassTuftBuffer(budget);
  const count = placeGrassTufts(camX, camY, radius, budget, cfg, buffer);
  return { buffer, count };
}

describe("DecorField hashing", () => {
  it("is stable for identical input and differs between seeds", () => {
    expect(hashCell(3, 7, 11, GRASS_SEED)).toBe(hashCell(3, 7, 11, GRASS_SEED));
    expect(hashCell(3, 7, 11, GRASS_SEED)).not.toBe(hashCell(3, 7, 12, GRASS_SEED));
    expect(hashCell(3, 7, 11, GRASS_SEED)).not.toBe(hashCell(4, 7, 11, GRASS_SEED));
  });
});

describe("grassCullRadius", () => {
  it("lets the fog radius dominate for close player cameras", () => {
    expect(grassCullRadius(500, 100)).toBe(GRASS_MIN_CULL_RADIUS);
    expect(grassCullRadius(700, 100)).toBeCloseTo(770);
  });

  it("grows with the visible ground extent when the camera pulls back", () => {
    expect(grassCullRadius(500, 700)).toBeCloseTo(770);
    expect(grassCullRadius(1_000_000, 1156)).toBe(GRASS_MAX_CULL_RADIUS);
  });

  it("always stays inside the supported radius band", () => {
    expect(grassCullRadius(0, 0)).toBe(GRASS_MIN_CULL_RADIUS);
    expect(grassCullRadius(Number.NaN, Number.NaN)).toBe(GRASS_MIN_CULL_RADIUS);
    expect(grassCullRadius(-10, -10)).toBe(GRASS_MIN_CULL_RADIUS);
    expect(grassCullRadius(5000, 5000)).toBe(GRASS_MAX_CULL_RADIUS);
  });
});

describe("grassLodScale", () => {
  it("keeps player-scale tufts unchanged", () => {
    expect(grassLodScale(0)).toBe(1);
    expect(grassLodScale(100)).toBe(1);
    expect(grassLodScale(Number.NaN)).toBe(1);
  });

  it("grows tufts for zoomed-out spectator cameras", () => {
    expect(grassLodScale(600)).toBeCloseTo(2);
    expect(grassLodScale(1200)).toBe(2.6);
  });

  it("never exceeds the LOD cap", () => {
    expect(grassLodScale(100_000)).toBe(2.6);
  });
});

describe("sampleCellTufts", () => {
  it("always returns the same tufts for the same world cell", () => {
    const first = readCell(12, 34);
    const second = readCell(12, 34);

    expect(first.count).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(first.count).toBeLessThanOrEqual(2);
  });

  it("wraps cell coordinates toroidally", () => {
    expect(readCell(0, 0)).toEqual(readCell(config.mapCellsX, config.mapCellsY));
    expect(readCell(99, 41)).toEqual(readCell(-1, 41));
    expect(readCell(7, 0)).toEqual(readCell(7 + config.mapCellsX * 3, -config.mapCellsY * 2));
  });

  it("keeps every tuft inside the map bounds", () => {
    for (let cy = 0; cy < 20; cy++) {
      for (let cx = 0; cx < 20; cx++) {
        const cell = readCell(cx, cy);
        for (let i = 0; i < cell.count; i++) {
          expect(cell.x[i]).toBeGreaterThanOrEqual(0);
          expect(cell.x[i]).toBeLessThan(worldWidth);
          expect(cell.y[i]).toBeLessThanOrEqual(0);
          expect(cell.y[i]).toBeGreaterThan(-worldHeight);
        }
      }
    }
  });

  it("produces no NaN even for degenerate configuration", () => {
    const weird: GrassFieldConfig[] = [
      { ...config, gridSize: 0, mapCellsX: 0, mapCellsY: -5, density: 2 },
      { ...config, gridSize: Number.NaN, mapCellsX: Number.POSITIVE_INFINITY, density: -1 },
      { ...config, mapCellsX: 1, mapCellsY: 1, density: 1 },
    ];

    for (const cfg of weird) {
      const out = createCellTufts();
      const count = sampleCellTufts(5, 5, cfg, out);
      expect(Number.isFinite(count)).toBe(true);
      for (let i = 0; i < count; i++) {
        expect(Number.isFinite(out.x[i])).toBe(true);
        expect(Number.isFinite(out.y[i])).toBe(true);
        expect(Number.isFinite(out.yaw[i])).toBe(true);
        expect(Number.isFinite(out.scale[i])).toBe(true);
        expect(Number.isFinite(out.colorMix[i])).toBe(true);
      }
    }
  });
});

describe("placeGrassTufts", () => {
  it("is deterministic for an unchanged camera", () => {
    const first = collect(1000, -1000, 400, 300);
    const second = collect(1000, -1000, 400, 300);

    expect(first.count).toBeGreaterThan(0);
    expect(first.count).toBe(second.count);
    expect(Array.from(first.buffer.x)).toEqual(Array.from(second.buffer.x));
    expect(Array.from(first.buffer.y)).toEqual(Array.from(second.buffer.y));
    expect(Array.from(first.buffer.yaw)).toEqual(Array.from(second.buffer.yaw));
  });

  it("returns the same tufts when the camera comes back", () => {
    const here = collect(700, -900, 300, 200);
    collect(2200, -2600, 300, 200);
    const back = collect(700, -900, 300, 200);

    expect(back.count).toBe(here.count);
    expect(Array.from(back.buffer.x)).toEqual(Array.from(here.buffer.x));
    expect(Array.from(back.buffer.y)).toEqual(Array.from(here.buffer.y));
  });

  it("culls every tuft to the requested radius, including across the map seam", () => {
    for (const [camX, camY] of [
      [1000, -1000],
      [5, -5],
      [worldWidth - 3, -(worldHeight - 3)],
    ]) {
      const { buffer, count } = collect(camX, camY, 240, 4000);
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const distance = toroidalDistance(
          buffer.x[i],
          buffer.y[i],
          camX,
          camY,
          worldWidth,
          worldHeight,
        );
        expect(distance).toBeLessThanOrEqual(240 + 1e-6);
      }
    }
  });

  it("never exceeds the budget", () => {
    for (const budget of [0, 1, 7, 120, 1200]) {
      const { count } = collect(1000, -1000, 6000, budget);
      expect(count).toBeLessThanOrEqual(budget);
    }
    expect(collect(1000, -1000, 6000, 0).count).toBe(0);
  });

  it("covers both the near band and the far band", () => {
    const { buffer, count } = collect(1000, -1000, 800, 1200);
    expect(count).toBeGreaterThan(900);

    let near = 0;
    let far = 0;
    for (let i = 0; i < count; i++) {
      const distance = toroidalDistance(
        buffer.x[i],
        buffer.y[i],
        1000,
        -1000,
        worldWidth,
        worldHeight,
      );
      if (distance < 200) near++;
      if (distance > 600) far++;
    }
    // Both bands must be populated; this catches a radius or wrap regression.
    expect(near).toBeGreaterThan(40);
    expect(far).toBeGreaterThan(100);
  });

  it("regenerates inside the map after a resize", () => {
    const resized: GrassFieldConfig = { ...config, mapCellsX: 40, mapCellsY: 64, density: 1 };
    const { buffer, count } = collect(200, -300, 500, 500, resized);

    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      expect(buffer.x[i]).toBeGreaterThanOrEqual(0);
      expect(buffer.x[i]).toBeLessThan(40 * 20);
      expect(buffer.y[i]).toBeLessThanOrEqual(0);
      expect(buffer.y[i]).toBeGreaterThan(-64 * 20);
    }
  });

  it("produces no NaN for hostile inputs", () => {
    const cases = [
      collect(Number.NaN, Number.NaN, 400, 100),
      collect(10, -10, Number.POSITIVE_INFINITY, 100),
      collect(10, -10, Number.NaN, 100),
      collect(10, -10, 400, Number.NaN),
      collect(10, -10, 400, 100, { ...config, density: Number.NaN }),
    ];

    for (const { buffer, count } of cases) {
      for (let i = 0; i < count; i++) {
        expect(Number.isFinite(buffer.x[i])).toBe(true);
        expect(Number.isFinite(buffer.y[i])).toBe(true);
        expect(Number.isFinite(buffer.yaw[i])).toBe(true);
        expect(Number.isFinite(buffer.scale[i])).toBe(true);
        expect(Number.isFinite(buffer.colorMix[i])).toBe(true);
      }
    }
    expect(cases[2].count).toBe(0);
    expect(cases[3].count).toBe(0);
  });
});
