// ROLE: Deterministic decor placement math: cell hashing, toroidal wrapping and camera-radius culling.
// No three.js, no rendering, no gameplay.

export const GRASS_SEED = 0x2f6e5b17;

/** Share of world cells that carry at least one tuft at the field centre. */
export const GRASS_CELL_DENSITY = 0.85;

/** Radial falloff exponent: tufts concentrate near the camera and fade into the fog. */
export const GRASS_DENSITY_FALLOFF = 1.5;

/** Upper bound of tufts a single occupied cell may produce. */
export const GRASS_TUFTS_PER_CELL_MAX = 2;

/** Expected tufts per occupied cell; used to calibrate density against the instance budget. */
export const GRASS_MEAN_TUFTS_PER_CELL = 1.5;

const SALT_OCCUPANCY = 0x11;
const SALT_TUFT_COUNT = 0x23;
const SALT_TUFT_BASE = 0x31;
const SALT_TUFT_STEP = 0x17;

const TAU = Math.PI * 2;

/** Configuration of the (single, uniform) grass biome. */
export interface GrassFieldConfig {
  seed: number;
  /** World units per map cell. */
  gridSize: number;
  mapCellsX: number;
  mapCellsY: number;
  /** Probability that a visited cell holds a tuft, clamped to 0..1. */
  density: number;
}

/** Tufts produced by one cell. Fixed capacity, written in place. */
export interface CellTufts {
  count: number;
  x: Float64Array;
  y: Float64Array;
  yaw: Float64Array;
  scale: Float64Array;
  colorMix: Float64Array;
}

/** Flat instance buffer consumed by GrassRenderer. Preallocated by the caller. */
export interface GrassTuftBuffer {
  x: Float32Array;
  y: Float32Array;
  yaw: Float32Array;
  scale: Float32Array;
  colorMix: Float32Array;
}

export function createCellTufts(): CellTufts {
  return {
    count: 0,
    x: new Float64Array(GRASS_TUFTS_PER_CELL_MAX),
    y: new Float64Array(GRASS_TUFTS_PER_CELL_MAX),
    yaw: new Float64Array(GRASS_TUFTS_PER_CELL_MAX),
    scale: new Float64Array(GRASS_TUFTS_PER_CELL_MAX),
    colorMix: new Float64Array(GRASS_TUFTS_PER_CELL_MAX),
  };
}

export function createGrassTuftBuffer(capacity: number): GrassTuftBuffer {
  const size = Math.max(0, Math.floor(capacity));
  return {
    x: new Float32Array(size),
    y: new Float32Array(size),
    yaw: new Float32Array(size),
    scale: new Float32Array(size),
    colorMix: new Float32Array(size),
  };
}

/** 32-bit integer avalanche hash of a cell position and salt. Stable across runs. */
export function hashCell(cellX: number, cellY: number, salt: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (cellX | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (cellY | 0), 0x165667b1);
  h = Math.imul(h ^ (salt | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Maps a uint32 hash into [0, 1). */
export function hashUnit(hash: number): number {
  return (hash >>> 8) / 0x1000000;
}

/** Positive modulo; the result always lives in [0, size). */
export function wrapIndex(value: number, size: number): number {
  if (!(size > 0)) return 0;
  const wrapped = value - Math.floor(value / size) * size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

/** Shortest signed delta on a torus of the given size. */
export function toroidalDelta(delta: number, size: number): number {
  if (!(size > 0)) return 0;
  return delta - Math.round(delta / size) * size;
}

export function toroidalDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  worldWidth: number,
  worldHeight: number,
): number {
  const dx = toroidalDelta(ax - bx, worldWidth);
  const dy = toroidalDelta(ay - by, worldHeight);
  return Math.hypot(dx, dy);
}

function sanitizeConfig(config: GrassFieldConfig): {
  seed: number;
  gridSize: number;
  mapCellsX: number;
  mapCellsY: number;
  density: number;
} {
  const gridSize = Number.isFinite(config.gridSize) && config.gridSize > 0 ? config.gridSize : 20;
  const mapCellsX =
    Number.isFinite(config.mapCellsX) && config.mapCellsX >= 1 ? Math.floor(config.mapCellsX) : 1;
  const mapCellsY =
    Number.isFinite(config.mapCellsY) && config.mapCellsY >= 1 ? Math.floor(config.mapCellsY) : 1;
  const rawDensity = Number.isFinite(config.density) ? config.density : 0;
  return {
    seed: Number.isFinite(config.seed) ? config.seed | 0 : GRASS_SEED,
    gridSize,
    mapCellsX,
    mapCellsY,
    density: Math.min(1, Math.max(0, rawDensity)),
  };
}

/**
 * Writes every tuft of one world cell into `out` and returns the count (0..2).
 * Cell coordinates wrap toroidally, so a cell and the same cell shifted by the
 * map size always yield byte-identical tufts.
 */
export function sampleCellTufts(
  cellX: number,
  cellY: number,
  config: GrassFieldConfig,
  out: CellTufts,
  density = config.density,
): number {
  const cfg = sanitizeConfig(config);
  const d = Number.isFinite(density) ? Math.min(1, Math.max(0, density)) : 0;
  return sampleNormalizedCell(
    cellX,
    cellY,
    cfg.gridSize,
    cfg.mapCellsX,
    cfg.mapCellsY,
    cfg.seed,
    d,
    out,
  );
}

function sampleNormalizedCell(
  cellX: number,
  cellY: number,
  gridSize: number,
  mapCellsX: number,
  mapCellsY: number,
  seed: number,
  density: number,
  out: CellTufts,
): number {
  out.count = 0;
  if (!(density > 0)) return 0;

  const cx = wrapIndex(Math.trunc(cellX), mapCellsX);
  const cy = wrapIndex(Math.trunc(cellY), mapCellsY);

  if (hashUnit(hashCell(cx, cy, SALT_OCCUPANCY, seed)) >= density) return 0;

  const count = 1 + (hashUnit(hashCell(cx, cy, SALT_TUFT_COUNT, seed)) < 0.5 ? 0 : 1);

  for (let i = 0; i < count; i++) {
    const salt = SALT_TUFT_BASE + i * SALT_TUFT_STEP;
    const jitterX = 0.08 + 0.84 * hashUnit(hashCell(cx, cy, salt, seed));
    const jitterY = 0.08 + 0.84 * hashUnit(hashCell(cx, cy, salt + 1, seed));
    // Map cell (cx, cy) -> world units. Y is negated because the scene maps
    // server grid rows downwards (world Y in [-height * gridSize, 0]).
    out.x[i] = (cx + jitterX) * gridSize;
    out.y[i] = -((cy + jitterY) * gridSize);
    out.yaw[i] = hashUnit(hashCell(cx, cy, salt + 2, seed)) * TAU;
    out.scale[i] = 0.7 + 0.5 * hashUnit(hashCell(cx, cy, salt + 3, seed));
    out.colorMix[i] = hashUnit(hashCell(cx, cy, salt + 4, seed));
  }

  out.count = count;
  return count;
}

// Scratch cell reused by placeGrassTufts so placement stays allocation-free.
const placementCell = createCellTufts();

function tryPlaceCell(
  cellX: number,
  cellY: number,
  camX: number,
  camY: number,
  radiusSq: number,
  worldWidth: number,
  worldHeight: number,
  gridSize: number,
  mapCellsX: number,
  mapCellsY: number,
  seed: number,
  density: number,
  out: GrassTuftBuffer,
  offset: number,
  capacity: number,
): number {
  const written = sampleNormalizedCell(
    cellX,
    cellY,
    gridSize,
    mapCellsX,
    mapCellsY,
    seed,
    density,
    placementCell,
  );
  if (written === 0) return 0;

  let placed = 0;
  for (let i = 0; i < written; i++) {
    if (offset + placed >= capacity) break;
    const dx = toroidalDelta(placementCell.x[i] - camX, worldWidth);
    const dy = toroidalDelta(placementCell.y[i] - camY, worldHeight);
    if (dx * dx + dy * dy > radiusSq) continue;

    const slot = offset + placed;
    out.x[slot] = placementCell.x[i];
    out.y[slot] = placementCell.y[i];
    out.yaw[slot] = placementCell.yaw[i];
    out.scale[slot] = placementCell.scale[i];
    out.colorMix[slot] = placementCell.colorMix[i];
    placed++;
  }
  return placed;
}

/**
 * Fills `out` with deterministic tufts within `cullRadiusWorld` of the camera,
 * nearest rings first, capped by `budget`. Returns the number of written tufts.
 *
 * Density is lowered automatically when the budget cannot cover the cull disc,
 * so the same field radius is kept while quality presets only change how many
 * tufts appear. Positions are always inside `[0, width] x [-height, 0]`.
 */
export function placeGrassTufts(
  camX: number,
  camY: number,
  cullRadiusWorld: number,
  budget: number,
  config: GrassFieldConfig,
  out: GrassTuftBuffer,
): number {
  const capacity = out.x.length;
  const requested = Math.min(
    capacity,
    Number.isFinite(budget) ? Math.max(0, Math.floor(budget)) : 0,
  );
  if (requested <= 0) return 0;
  if (!(cullRadiusWorld > 0) || !Number.isFinite(cullRadiusWorld)) return 0;

  const safeX = Number.isFinite(camX) ? camX : 0;
  const safeY = Number.isFinite(camY) ? camY : 0;
  const cfg = sanitizeConfig(config);
  const gs = cfg.gridSize;
  const worldWidth = cfg.mapCellsX * gs;
  const worldHeight = cfg.mapCellsY * gs;

  // Never wrap onto itself: the relative cell square must stay smaller than the map.
  const maxRing = Math.min(
    Math.ceil(cullRadiusWorld / gs),
    Math.floor((cfg.mapCellsX - 1) / 2),
    Math.floor((cfg.mapCellsY - 1) / 2),
  );
  if (maxRing < 0) return 0;

  const visitedCells = Math.PI * (maxRing + 0.5) * (maxRing + 0.5);
  // Integral of (1 - t^2)^1.5 over the disc is 0.4 * pi * R^2; this spends the
  // same budget across the whole cull disc instead of a hard cut at its edge.
  const weightedCells = 0.4 * Math.max(1, visitedCells);
  const calibrated = requested / (GRASS_MEAN_TUFTS_PER_CELL * weightedCells);
  const centerDensity = Math.min(cfg.density, calibrated);
  if (!(centerDensity > 0)) return 0;

  const camCellX = Math.floor(safeX / gs);
  const camCellY = Math.floor(-safeY / gs);
  const radiusSq = cullRadiusWorld * cullRadiusWorld;
  const radiusCells = Math.max(1, cullRadiusWorld / gs);
  const radiusCellsSq = radiusCells * radiusCells;
  let count = 0;

  const place = (cellX: number, cellY: number) => {
    const dx = cellX - camCellX;
    const dy = cellY - camCellY;
    const t2 = (dx * dx + dy * dy) / radiusCellsSq;
    if (t2 >= 1) return;
    const density = centerDensity * (1 - t2) ** GRASS_DENSITY_FALLOFF;
    if (!(density > 0)) return;

    count += tryPlaceCell(
      cellX,
      cellY,
      safeX,
      safeY,
      radiusSq,
      worldWidth,
      worldHeight,
      gs,
      cfg.mapCellsX,
      cfg.mapCellsY,
      cfg.seed,
      density,
      out,
      count,
      requested,
    );
  };

  for (let ring = 0; ring <= maxRing && count < requested; ring++) {
    if (ring === 0) {
      place(camCellX, camCellY);
      continue;
    }
    // Square ring perimeter, deterministic order.
    for (let dx = -ring; dx <= ring && count < requested; dx++) {
      place(camCellX + dx, camCellY - ring);
      place(camCellX + dx, camCellY + ring);
    }
    for (let dy = -ring + 1; dy <= ring - 1 && count < requested; dy++) {
      place(camCellX - ring, camCellY + dy);
      place(camCellX + ring, camCellY + dy);
    }
  }

  return count;
}
