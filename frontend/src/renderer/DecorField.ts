// ROLE: Deterministic decor placement math: grass clumps, prop scattering, cell hashing,
// toroidal wrapping and camera-radius culling. No three.js, no rendering, no gameplay.

export const GRASS_SEED = 0x2f6e5b17;

/** Share of world cells that carry at least one tuft at the field centre. */
export const GRASS_CELL_DENSITY = 1;

/**
 * Radial falloff exponent. A mild falloff keeps the grass under the snake
 * lush while the outer rings thin into the fog; the field is biased forward so
 * the density peak sits in front of the player, not behind the camera.
 */
export const GRASS_DENSITY_FALLOFF = 1.0;

/** Upper bound of tufts a single occupied cell may produce. */
export const GRASS_TUFTS_PER_CELL_MAX = 6;

/** Expected tufts per occupied cell; used to calibrate density against the instance budget. */
export const GRASS_MEAN_TUFTS_PER_CELL = 4.5;

/**
 * Grass placement subdivides each 20-unit world cell into this many cells per
 * axis. A 300-unit field has too few 20-unit cells to hold a dense 6000-tuft
 * budget at 3-6 tufts per cell; 10-unit placement cells keep the clump grammar.
 */
export const GRASS_CELL_DIVISIONS = 2;

/** Side of the broad super-cell that decides whether a patch of lawn is lush or thin, in placement cells. */
export const GRASS_CLUSTER_CELLS = 8;

/**
 * Side of the fine clump, in placement cells. A 10-unit placement cell makes
 * this a 20-unit group: 12-24 tufts that share colour, height and dryness.
 */
export const GRASS_FINE_CLUSTER_CELLS = 2;

/** Lowest density factor a clump may reach; thin patches still keep a full grass cover. */
export const GRASS_CLUSTER_MIN = 0.55;

/** Mean of the combined cluster factor; placement divides by it so the budget still lands. */
export const GRASS_CLUSTER_MEAN = (GRASS_CLUSTER_MIN + 1) / 2;

/** Hard per-family buffer caps: the dense grass field and the sparse stones. */
export const DECOR_BUDGET_CAPS = {
  grass: 16000,
  stones: 144,
} as const;

/** Prop anchor block in map cells; two cells keep props sparse but not grid-like. */
export const PROP_BLOCK_CELLS = 2;

/** Props thin out towards the cull radius so the field has no visible prop edge. */
export const PROP_DENSITY_FALLOFF = 1.1;

/**
 * Stone occupancy of the block lattice. With the small stone budget this keeps
 * a default screen at roughly a dozen small rocks.
 */
export const PROP_OCCUPANCY_SHARE = 0.34;

export const PROP_VARIANT_COUNTS = {
  stone: 3,
} as const;

export type DecorPropType = keyof typeof PROP_VARIANT_COUNTS;

const SALT_OCCUPANCY = 0x11;
const SALT_TUFT_COUNT = 0x23;
const SALT_TUFT_BASE = 0x31;
const SALT_TUFT_STEP = 0x17;
const SALT_CLUSTER = 0x53;
const SALT_CLUSTER_BROAD = 0x54;
const SALT_CLUMP_HEIGHT = 0x57;
const SALT_CLUMP_COLOR = 0x59;
const SALT_CLUMP_DRY = 0x5b;
const SALT_PROP = {
  stone: 0x61,
} as const;

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

/** Flat instance buffer for one prop family. `variant` selects the baked silhouette. */
export interface DecorPropBuffer {
  x: Float32Array;
  y: Float32Array;
  yaw: Float32Array;
  scale: Float32Array;
  variant: Float32Array;
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

export function createDecorPropBuffer(capacity: number): DecorPropBuffer {
  const size = Math.max(0, Math.floor(capacity));
  return {
    x: new Float32Array(size),
    y: new Float32Array(size),
    yaw: new Float32Array(size),
    scale: new Float32Array(size),
    variant: new Float32Array(size),
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
  if (!(size > 0) || !Number.isFinite(value)) return 0;
  const wrapped = value - Math.floor(value / size) * size;
  return wrapped < 0 ? wrapped + size : wrapped;
}

/** Shortest signed delta on a torus of the given size. */
export function toroidalDelta(delta: number, size: number): number {
  if (!(size > 0) || !Number.isFinite(delta)) return 0;
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

function safeCellSize(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

function safeSeed(value: number): number {
  return Number.isFinite(value) ? value | 0 : GRASS_SEED;
}

/** Shared look of one fine grass clump. Values are stable for the whole clump. */
export interface GrassClumpProfile {
  /** Density multiplier in [GRASS_CLUSTER_MIN, 1]. */
  density: number;
  /** Uniform tuft scale multiplier in [0.88, 1.12]. */
  height: number;
  /** Colour bias in [0, 1]; 0 is dark, 1 is bright. */
  color: number;
  /** Whole clumps go dry together instead of scattering dry single tufts. */
  dry: boolean;
}

function smoothstep01(value: number): number {
  return value * value * (3 - 2 * value);
}

/**
 * Style of the fine clump that owns a world cell. Two spatial scales are
 * combined: a 20-unit group (fine colour/height/dryness, sharp density change)
 * and an 80-unit patch (broad lush/thin gradient). Coordinates are wrapped, so
 * the same cell shifted by the map size yields the same clump. The fine-cell
 * style keeps neighbouring tufts coherent.
 */
export function clumpProfile(
  cellX: number,
  cellY: number,
  mapCellsX: number,
  mapCellsY: number,
  seed: number,
): GrassClumpProfile {
  const sizeX = safeCellSize(mapCellsX);
  const sizeY = safeCellSize(mapCellsY);
  const cx = wrapIndex(Math.trunc(cellX), sizeX);
  const cy = wrapIndex(Math.trunc(cellY), sizeY);
  const clumpSeed = safeSeed(seed);

  const fineX = Math.floor(cx / GRASS_FINE_CLUSTER_CELLS);
  const fineY = Math.floor(cy / GRASS_FINE_CLUSTER_CELLS);
  const broadX = Math.floor(cx / GRASS_CLUSTER_CELLS);
  const broadY = Math.floor(cy / GRASS_CLUSTER_CELLS);

  const fine = smoothstep01(hashUnit(hashCell(fineX, fineY, SALT_CLUSTER, clumpSeed)));
  const broad = smoothstep01(hashUnit(hashCell(broadX, broadY, SALT_CLUSTER_BROAD, clumpSeed)));
  const density = GRASS_CLUSTER_MIN + (1 - GRASS_CLUSTER_MIN) * (fine * 0.6 + broad * 0.4);

  return {
    density,
    height: 0.88 + 0.24 * hashUnit(hashCell(fineX, fineY, SALT_CLUMP_HEIGHT, clumpSeed)),
    color: hashUnit(hashCell(fineX, fineY, SALT_CLUMP_COLOR, clumpSeed)),
    dry: hashUnit(hashCell(fineX, fineY, SALT_CLUMP_DRY, clumpSeed)) > 0.92,
  };
}

/** Density multiplier of the clump that owns a world cell, in [GRASS_CLUSTER_MIN, 1]. */
export function clumpDensity(
  cellX: number,
  cellY: number,
  mapCellsX: number,
  mapCellsY: number,
  seed: number,
): number {
  return clumpProfile(cellX, cellY, mapCellsX, mapCellsY, seed).density;
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
 * Writes every tuft of one world cell into `out` and returns the count
 * (0..GRASS_TUFTS_PER_CELL_MAX). Cell coordinates wrap toroidally, so a cell
 * and the same cell shifted by the map size always yield byte-identical tufts.
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

  const clump = clumpProfile(cx, cy, mapCellsX, mapCellsY, seed);
  const localDensity = Math.min(1, (density * clump.density) / GRASS_CLUSTER_MEAN);
  if (hashUnit(hashCell(cx, cy, SALT_OCCUPANCY, seed)) >= localDensity) return 0;

  const count = 3 + Math.min(3, Math.floor(hashUnit(hashCell(cx, cy, SALT_TUFT_COUNT, seed)) * 4));
  const clumpTone = 0.5 + (clump.color - 0.5) * 0.5;
  const tuftVariation = 0.45;

  for (let i = 0; i < count; i++) {
    const salt = SALT_TUFT_BASE + i * SALT_TUFT_STEP;
    // Jitter may cross the 10-unit cell border, so neighbouring clumps
    // interleave instead of forming rows on the fine placement grid.
    const jitterX = -0.2 + 1.4 * hashUnit(hashCell(cx, cy, salt, seed));
    const jitterY = -0.2 + 1.4 * hashUnit(hashCell(cx, cy, salt + 1, seed));
    const worldCellX = wrapIndex(cx + jitterX, mapCellsX);
    const worldCellY = wrapIndex(cy + jitterY, mapCellsY);
    // Map cell (cx, cy) -> world units. Y is negated because the scene maps
    // server grid rows downwards (world Y in [-height * gridSize, 0]).
    out.x[i] = worldCellX * gridSize;
    out.y[i] = -(worldCellY * gridSize);
    out.yaw[i] = hashUnit(hashCell(cx, cy, salt + 2, seed)) * TAU;
    const tuftScale = hashUnit(hashCell(cx, cy, salt + 3, seed));
    const tuftColor = hashUnit(hashCell(cx, cy, salt + 4, seed));
    out.scale[i] = (0.9 + 0.55 * tuftScale) * clump.height;
    out.colorMix[i] = clump.dry
      ? 0.94 + 0.06 * tuftColor
      : Math.min(1, Math.max(0, clumpTone + (tuftColor - 0.5) * tuftVariation));
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
    // Write the wrapped copy nearest the camera. The cell content is canonical
    // inside the map, but at the seam its absolute position is a full period
    // away; drawing that copy would make half the field disappear.
    out.x[slot] = camX + dx;
    out.y[slot] = camY + dy;
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
 * tufts appear. Positions are wrapped to the camera side, so near the seam they
 * can lie just outside the canonical `[0, width] x [-height, 0]` rectangle.
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
  // Integral of (1 - t^2)^p over the disc is pi * R^2 / (p + 1); this spends
  // the same budget across the whole cull disc instead of a hard cut at its edge.
  const weightedCells = visitedCells / (GRASS_DENSITY_FALLOFF + 1);
  const calibrated = requested / (GRASS_MEAN_TUFTS_PER_CELL * weightedCells);
  // A config density of 1 means "no artificial cap": the calibrated density may
  // exceed 1 in a dense field, and per-cell occupancy clamps at 1.
  const densityCap = cfg.density >= 1 ? Number.POSITIVE_INFINITY : cfg.density;
  const centerDensity = Math.min(calibrated, densityCap);
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

const PROP_SCALE_RANGE: Record<DecorPropType, readonly [number, number]> = {
  // Footprint in world units: stones 8..12.
  stone: [4, 6],
};

const SALT_PROP_VARIANT = 0x97;
const SALT_PROP_COLOR = 0xa9;
const SALT_PROP_JITTER = 0xb1;

function writeProp(
  type: DecorPropType,
  blockX: number,
  blockY: number,
  blockWorld: number,
  camX: number,
  camY: number,
  radiusSq: number,
  worldWidth: number,
  worldHeight: number,
  seed: number,
  out: DecorPropBuffer,
  slot: number,
): boolean {
  const jitterX = 0.15 + 0.7 * hashUnit(hashCell(blockX, blockY, SALT_PROP_JITTER, seed));
  const jitterY = 0.15 + 0.7 * hashUnit(hashCell(blockX, blockY, SALT_PROP_JITTER + 1, seed));
  const x = (blockX + jitterX) * blockWorld;
  const y = -((blockY + jitterY) * blockWorld);

  const dx = toroidalDelta(x - camX, worldWidth);
  const dy = toroidalDelta(y - camY, worldHeight);
  if (dx * dx + dy * dy > radiusSq) return false;

  const [minScale, maxScale] = PROP_SCALE_RANGE[type];
  const variantCount = PROP_VARIANT_COUNTS[type];

  // Same seam rule as grass: draw the copy closest to the camera, not the
  // canonical one a full map period away.
  out.x[slot] = camX + dx;
  out.y[slot] = camY + dy;
  out.yaw[slot] = hashUnit(hashCell(blockX, blockY, SALT_PROP_JITTER + 2, seed)) * TAU;
  out.scale[slot] =
    minScale +
    (maxScale - minScale) * hashUnit(hashCell(blockX, blockY, SALT_PROP_JITTER + 3, seed));
  out.variant[slot] = Math.min(
    variantCount - 1,
    Math.floor(hashUnit(hashCell(blockX, blockY, SALT_PROP_VARIANT, seed)) * variantCount),
  );
  out.colorMix[slot] = hashUnit(hashCell(blockX, blockY, SALT_PROP_COLOR, seed));
  return true;
}

/**
 * Scatters one prop family over the cull disc. Props occupy coarse
 * PROP_BLOCK_CELLS blocks (one prop per occupied block at most), are ordered
 * nearest-first and fade out radially with the same toroidal rules as grass.
 * The per-family budget only caps the result; it never widens the field.
 */
export function placeDecorProps(
  type: DecorPropType,
  camX: number,
  camY: number,
  cullRadiusWorld: number,
  budget: number,
  config: GrassFieldConfig,
  out: DecorPropBuffer,
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
  const blockWorld = PROP_BLOCK_CELLS * cfg.gridSize;
  const worldWidth = cfg.mapCellsX * cfg.gridSize;
  const worldHeight = cfg.mapCellsY * cfg.gridSize;
  const blocksX = Math.max(1, Math.floor(cfg.mapCellsX / PROP_BLOCK_CELLS));
  const blocksY = Math.max(1, Math.floor(cfg.mapCellsY / PROP_BLOCK_CELLS));

  const maxRing = Math.min(
    Math.ceil(cullRadiusWorld / blockWorld),
    Math.floor((blocksX - 1) / 2),
    Math.floor((blocksY - 1) / 2),
  );
  if (maxRing < 0) return 0;

  const weightedBlocks = 0.4 * Math.PI * (maxRing + 0.5) * (maxRing + 0.5);
  const centerProbability = Math.min(
    1,
    (requested * PROP_OCCUPANCY_SHARE) / Math.max(1, weightedBlocks),
  );
  if (!(centerProbability > 0)) return 0;

  const camBlockX = Math.floor(safeX / blockWorld);
  const camBlockY = Math.floor(-safeY / blockWorld);
  const radiusSq = cullRadiusWorld * cullRadiusWorld;
  const radiusBlocks = Math.max(1, cullRadiusWorld / blockWorld);
  const radiusBlocksSq = radiusBlocks * radiusBlocks;
  const salt = SALT_PROP[type];
  let count = 0;

  const place = (blockX: number, blockY: number) => {
    const dx = blockX - camBlockX;
    const dy = blockY - camBlockY;
    const t2 = (dx * dx + dy * dy) / radiusBlocksSq;
    if (t2 >= 1) return;
    const density = centerProbability * (1 - t2) ** PROP_DENSITY_FALLOFF;
    if (!(density > 0)) return;

    const wrappedX = wrapIndex(blockX, blocksX);
    const wrappedY = wrapIndex(blockY, blocksY);
    if (hashUnit(hashCell(wrappedX, wrappedY, salt, cfg.seed)) >= density) return;
    if (
      writeProp(
        type,
        wrappedX,
        wrappedY,
        blockWorld,
        safeX,
        safeY,
        radiusSq,
        worldWidth,
        worldHeight,
        cfg.seed,
        out,
        count,
      )
    ) {
      count++;
    }
  };

  for (let ring = 0; ring <= maxRing && count < requested; ring++) {
    if (ring === 0) {
      place(camBlockX, camBlockY);
      continue;
    }
    for (let dx = -ring; dx <= ring && count < requested; dx++) {
      place(camBlockX + dx, camBlockY - ring);
      place(camBlockX + dx, camBlockY + ring);
    }
    for (let dy = -ring + 1; dy <= ring - 1 && count < requested; dy++) {
      place(camBlockX - ring, camBlockY + dy);
      place(camBlockX + ring, camBlockY + dy);
    }
  }

  return count;
}
