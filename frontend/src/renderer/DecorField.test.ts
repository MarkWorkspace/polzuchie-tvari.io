// ROLE: Tests for deterministic grass clumping and prop placement, toroidal wrap, culling and budget caps.
import { describe, expect, it } from "vitest";
import {
  clumpDensity,
  createCellTufts,
  createDecorPropBuffer,
  createGrassTuftBuffer,
  DECOR_BUDGET_CAPS,
  type DecorPropType,
  GRASS_CLUSTER_CELLS,
  GRASS_CLUSTER_MIN,
  GRASS_SEED,
  GRASS_TUFTS_PER_CELL_MAX,
  type GrassFieldConfig,
  hashCell,
  PROP_VARIANT_COUNTS,
  placeDecorProps,
  placeGrassTufts,
  sampleCellTufts,
  toroidalDelta,
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
    expect(first.count).toBeGreaterThanOrEqual(3);
    expect(first.count).toBeLessThanOrEqual(GRASS_TUFTS_PER_CELL_MAX);
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

    const nanCell = createCellTufts();
    const nanCount = sampleCellTufts(Number.NaN, Number.NaN, denseConfig, nanCell);
    expect(Number.isFinite(nanCount)).toBe(true);
    for (let i = 0; i < nanCount; i++) {
      expect(Number.isFinite(nanCell.x[i])).toBe(true);
      expect(Number.isFinite(nanCell.y[i])).toBe(true);
      expect(Number.isFinite(nanCell.yaw[i])).toBe(true);
      expect(Number.isFinite(nanCell.scale[i])).toBe(true);
      expect(Number.isFinite(nanCell.colorMix[i])).toBe(true);
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

  it("regenerates inside the cull disc after a resize", () => {
    const resized: GrassFieldConfig = { ...config, mapCellsX: 40, mapCellsY: 64, density: 1 };
    const { buffer, count } = collect(200, -300, 500, 500, resized);

    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const distance = toroidalDistance(buffer.x[i], buffer.y[i], 200, -300, 40 * 20, 64 * 20);
      expect(distance).toBeLessThanOrEqual(500 + 1e-6);
    }
  });

  it("writes the seam copy on the camera side instead of a full period away", () => {
    const camX = 3;
    const camY = -3;
    const { buffer, count } = collect(camX, camY, 240, 4000);
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      // Absolute coordinates must be near the camera; a canonical wrapped copy
      // at x ~ worldWidth would render on the far side of the torus.
      expect(Math.abs(buffer.x[i] - camX)).toBeLessThanOrEqual(240 + 1e-6);
      expect(Math.abs(buffer.y[i] - camY)).toBeLessThanOrEqual(240 + 1e-6);
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

describe("grass clumping", () => {
  it("keeps the cluster factor inside its band and varies across the map", () => {
    const values = new Set<number>();
    let min = 1;
    let max = 0;
    for (let cy = 0; cy < config.mapCellsY; cy += 7) {
      for (let cx = 0; cx < config.mapCellsX; cx += 7) {
        const value = clumpDensity(cx, cy, config.mapCellsX, config.mapCellsY, GRASS_SEED);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(GRASS_CLUSTER_MIN);
        expect(value).toBeLessThanOrEqual(1);
        values.add(value);
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    // Both lush and nearly bare patches must exist, with real contrast between them.
    expect(values.size).toBeGreaterThan(4);
    expect(max - min).toBeGreaterThan(0.4);
    expect(Number.isFinite(clumpDensity(Number.NaN, Number.NaN, 100, 100, GRASS_SEED))).toBe(true);
  });

  it("wraps cell coordinates toroidally", () => {
    expect(clumpDensity(3, 5, 100, 100, GRASS_SEED)).toBe(
      clumpDensity(3 + 100, 5 - 200, 100, 100, GRASS_SEED),
    );
    expect(clumpDensity(-1, 99, 100, 100, GRASS_SEED)).toBe(
      clumpDensity(99, 99, 100, 100, GRASS_SEED),
    );
  });

  it("is constant inside one super-cell and seed dependent", () => {
    const baseX = GRASS_CLUSTER_CELLS * 5;
    const baseY = GRASS_CLUSTER_CELLS * 6;
    const cases = [
      [baseX, baseY],
      [baseX + 1, baseY + GRASS_CLUSTER_CELLS - 1],
      [baseX + GRASS_CLUSTER_CELLS - 1, baseY],
    ];
    const reference = clumpDensity(cases[0][0], cases[0][1], 100, 100, GRASS_SEED);
    for (const [cx, cy] of cases) {
      expect(clumpDensity(cx, cy, 100, 100, GRASS_SEED)).toBe(reference);
    }
    expect(clumpDensity(baseX, baseY, 100, 100, GRASS_SEED + 1)).not.toBe(reference);
  });

  it("makes cells sparser in bare patches than in lush ones", () => {
    let lushX = 0;
    let lushY = 0;
    let bareX = 0;
    let bareY = 0;
    let max = -1;
    let min = 2;
    for (let sy = 0; sy < 12; sy++) {
      for (let sx = 0; sx < 12; sx++) {
        const cellX = sx * GRASS_CLUSTER_CELLS;
        const cellY = sy * GRASS_CLUSTER_CELLS;
        const value = clumpDensity(cellX, cellY, 100, 100, GRASS_SEED);
        if (value > max) {
          max = value;
          lushX = cellX;
          lushY = cellY;
        }
        if (value < min) {
          min = value;
          bareX = cellX;
          bareY = cellY;
        }
      }
    }

    const occupied = (startX: number, startY: number) => {
      let count = 0;
      const out = createCellTufts();
      for (let cy = 0; cy < GRASS_CLUSTER_CELLS; cy++) {
        for (let cx = 0; cx < GRASS_CLUSTER_CELLS; cx++) {
          if (sampleCellTufts(startX + cx, startY + cy, denseConfig, out) > 0) count++;
        }
      }
      return count;
    };

    const lush = occupied(lushX, lushY);
    const bare = occupied(bareX, bareY);
    expect(lush).toBeGreaterThan(bare * 1.5);
    expect(lush).toBeGreaterThan(GRASS_CLUSTER_CELLS * GRASS_CLUSTER_CELLS * 0.4);
    expect(bare).toBeLessThan(GRASS_CLUSTER_CELLS * GRASS_CLUSTER_CELLS * 0.6);
  });
});

describe("decor budget caps", () => {
  it("keeps the dense grass capacity above every preset budget", () => {
    expect(DECOR_BUDGET_CAPS.grass).toBeGreaterThanOrEqual(16000);
    expect(DECOR_BUDGET_CAPS.stones).toBe(144);
  });
});

const STONE: DecorPropType = "stone";

function collectProps(
  type: DecorPropType,
  camX: number,
  camY: number,
  radius: number,
  budget: number,
  cfg = config,
) {
  const buffer = createDecorPropBuffer(Math.max(0, budget));
  const count = placeDecorProps(type, camX, camY, radius, budget, cfg, buffer);
  return { buffer, count };
}

function snapshotProps(
  type: DecorPropType,
  camX: number,
  camY: number,
  radius: number,
  budget: number,
) {
  const { buffer, count } = collectProps(type, camX, camY, radius, budget);
  return {
    count,
    x: Array.from(buffer.x.subarray(0, count)),
    y: Array.from(buffer.y.subarray(0, count)),
    yaw: Array.from(buffer.yaw.subarray(0, count)),
    scale: Array.from(buffer.scale.subarray(0, count)),
    variant: Array.from(buffer.variant.subarray(0, count)),
    colorMix: Array.from(buffer.colorMix.subarray(0, count)),
  };
}

describe("placeDecorProps", () => {
  it("is deterministic for stones", () => {
    const first = snapshotProps(STONE, 1200, -1400, 900, DECOR_BUDGET_CAPS.stones);
    const second = snapshotProps(STONE, 1200, -1400, 900, DECOR_BUDGET_CAPS.stones);
    expect(first.count).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("returns the same stones when the camera crosses the map seam", () => {
    const here = snapshotProps(STONE, 0, 0, 500, 120);
    const wrapped = snapshotProps(STONE, worldWidth, -worldHeight, 500, 120);
    expect(here.count).toBeGreaterThan(0);
    expect(wrapped.count).toBe(here.count);

    for (let i = 0; i < here.count; i++) {
      // The instances are drawn on the camera side of the seam, so only the
      // toroidal delta is invariant, not the absolute coordinate.
      expect(toroidalDelta(wrapped.x[i] - here.x[i], worldWidth)).toBeCloseTo(0, 2);
      expect(toroidalDelta(wrapped.y[i] - here.y[i], worldHeight)).toBeCloseTo(0, 2);
      expect(wrapped.yaw[i]).toBe(here.yaw[i]);
      expect(wrapped.scale[i]).toBe(here.scale[i]);
      expect(wrapped.variant[i]).toBe(here.variant[i]);
      expect(wrapped.colorMix[i]).toBe(here.colorMix[i]);
    }
  });

  it("keeps every stone inside the cull radius, including across the seam", () => {
    for (const [camX, camY] of [
      [1000, -1000],
      [6, -6],
      [worldWidth - 4, -(worldHeight - 4)],
    ]) {
      const { buffer, count } = collectProps(STONE, camX, camY, 320, 240);
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
        expect(distance).toBeLessThanOrEqual(320 + 1e-6);
      }
    }
  });

  it("never exceeds the stone budget and hides at zero", () => {
    for (const budget of [0, 1, 5, 40, DECOR_BUDGET_CAPS.stones]) {
      expect(collectProps(STONE, 900, -900, 900, budget).count).toBeLessThanOrEqual(budget);
    }
    expect(collectProps(STONE, 900, -900, 900, 0).count).toBe(0);
  });

  it("uses every baked silhouette and stays within the stone size band", () => {
    const seen = new Set<number>();
    const { buffer, count } = collectProps(STONE, 700, -700, 1100, DECOR_BUDGET_CAPS.stones * 5);
    expect(count).toBeGreaterThan(40);
    for (let i = 0; i < count; i++) {
      const variant = buffer.variant[i];
      expect(Number.isInteger(variant)).toBe(true);
      expect(variant).toBeGreaterThanOrEqual(0);
      expect(variant).toBeLessThan(PROP_VARIANT_COUNTS.stone);
      // Authored around unit radius, so scale 4..6 is an 8..12 world-unit footprint.
      expect(buffer.scale[i]).toBeGreaterThanOrEqual(4);
      expect(buffer.scale[i]).toBeLessThanOrEqual(6);
      expect(buffer.colorMix[i]).toBeGreaterThanOrEqual(0);
      expect(buffer.colorMix[i]).toBeLessThan(1);
      seen.add(variant);
    }
    expect(seen.size).toBe(PROP_VARIANT_COUNTS.stone);
  });

  it("produces no NaN for hostile inputs", () => {
    const cases = [
      collectProps(STONE, Number.NaN, Number.NaN, 400, 100),
      collectProps(STONE, 10, -10, Number.POSITIVE_INFINITY, 100),
      collectProps(STONE, 10, -10, Number.NaN, 100),
      collectProps(STONE, 10, -10, 400, Number.NaN),
      collectProps(STONE, 10, -10, 400, 100, { ...config, density: Number.NaN }),
      collectProps(STONE, 10, -10, 400, 100, {
        ...config,
        gridSize: 0,
        mapCellsX: 0,
        mapCellsY: -5,
      }),
    ];

    for (const { buffer, count } of cases) {
      for (let i = 0; i < count; i++) {
        expect(Number.isFinite(buffer.x[i])).toBe(true);
        expect(Number.isFinite(buffer.y[i])).toBe(true);
        expect(Number.isFinite(buffer.yaw[i])).toBe(true);
        expect(Number.isFinite(buffer.scale[i])).toBe(true);
        expect(Number.isFinite(buffer.variant[i])).toBe(true);
        expect(Number.isFinite(buffer.colorMix[i])).toBe(true);
      }
    }
    expect(cases[2].count).toBe(0);
    expect(cases[3].count).toBe(0);
  });
});
