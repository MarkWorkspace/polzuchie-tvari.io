// ROLE: Константы (WORLD_WIDTH, GRID_SIZE и др.). Единственная копия констант физики на фронте.

export const DEFAULT_SERVER_TICK_RATE = 30;
export const MAX_TURN_SPEED_DEG = 290.0;
export const MIN_TURN_RADIUS = 0.5;
export const TURN_RADIUS_THICKNESS_COEFF = 1.0;
export const BASE_HEAD_RADIUS = 0.2;
export const SCORE_THICKNESS_SCALE = 0.0005;
export const MIN_FOG_RADIUS = 900.0;
export const FOG_SCORE_EXPANSION_COEFF = 0.5;
export const BASE_SPEED_PER_SECOND = 6.0;
export const TURN_IDLE_SMOOTHING_AT_20HZ = 0.3;
export const TURN_ACTIVE_SMOOTHING_AT_20HZ = 0.15;

export const frameSmoothing = (smoothingAt20Hz: number, dt: number) =>
  1 - Math.pow(1 - smoothingAt20Hz, dt / 0.05);

export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 100;
export const gridSize = 20;
export const WG = WORLD_WIDTH * gridSize;
export const HG = WORLD_HEIGHT * gridSize;

export const wrapOffsets: [number, number][] = [
  [0, 0],
  [WG, 0],
  [-WG, 0],
  [0, HG],
  [0, -HG],
  [WG, HG],
  [-WG, HG],
  [WG, -HG],
  [-WG, -HG]
];

export const SKINS = [
  { id: "#ef4444", name: "Красный", bg: "#ef4444" },
  { id: "#3b82f6", name: "Синий", bg: "#3b82f6" },
  { id: "#eab308", name: "Желтый", bg: "#eab308" },
  { id: "#22c55e", name: "Зеленый", bg: "#22c55e" },
  { id: "#ec4899", name: "Розовый", bg: "#ec4899" },
  { id: "#a855f7", name: "Фиолетовый", bg: "#a855f7" },
  { id: "zebra", name: "Зебра", bg: "repeating-linear-gradient(45deg, #fff, #fff 10px, #000 10px, #000 20px)" },
  { id: "tiger", name: "Тигр", bg: "repeating-linear-gradient(45deg, #f97316, #f97316 10px, #000 10px, #000 20px)" },
  { id: "rainbow", name: "Радуга", bg: "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)" },
  { id: "cyberpunk", name: "Киберпанк", bg: "repeating-linear-gradient(45deg, #f0f, #f0f 10px, #0ff 10px, #0ff 20px)" }
];

