// ROLE: Regression tests for food instance hot path: fog visibility, interpolation,
// head attraction, black-hole gravity/fast path and last-state cache invalidation.
import { describe, expect, it } from "vitest";
import type { BlackHole, Food, GameState, ServerFoodConfig } from "../types/game";
import { computeFood } from "./FoodComputer";
import { gridToWorldX, gridToWorldY } from "./shared/WorldMath";

const GRID_SIZE = 20;
const MAP_W = 100;
const MAP_H = 100;

const DEFAULT_SERVER_FOOD: ServerFoodConfig = {
  base_radius: 0.2,
  radius_value_scale: 0.1,
  death_drop_score_fraction: 0.5,
  attraction_radius: 3,
  attraction_speed: 8,
};

function makeFood(id: number, x: number, y: number, value = 4): Food {
  return { id, x, y, value, color: "#ff0000" };
}

function makeState(
  options: {
    foods?: Food[];
    blackHoles?: BlackHole[];
    blackHolesEnabled?: number;
    serverFood?: Partial<ServerFoodConfig>;
    width?: number;
    height?: number;
  } = {},
): GameState {
  return {
    server_world: {
      width: options.width ?? MAP_W,
      height: options.height ?? MAP_H,
      ...(options.blackHolesEnabled !== undefined
        ? { black_holes_enabled: options.blackHolesEnabled }
        : {}),
    },
    server_food: { ...DEFAULT_SERVER_FOOD, ...options.serverFood },
    players: {},
    foods: options.foods ?? [],
    ...(options.blackHoles ? { black_holes: options.blackHoles } : {}),
  };
}

function createHarness(count = 16) {
  const matrices = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const images = new Int32Array(count);

  const run = (
    state: GameState,
    lastState: GameState | null,
    options: {
      progress?: number;
      myPlayer?: any;
      myHeadX?: number;
      myHeadY?: number;
      camX?: number;
      camY?: number;
      fogRadiusWorld?: number;
      dt?: number;
      showAll?: boolean;
    } = {},
  ) =>
    computeFood(
      state,
      lastState,
      options.progress ?? 1,
      options.myPlayer ?? null,
      options.myHeadX ?? 0,
      options.myHeadY ?? 0,
      options.camX ?? 0,
      options.camY ?? 0,
      options.fogRadiusWorld ?? 1000,
      options.dt ?? 0.1,
      GRID_SIZE,
      options.showAll ?? true,
      matrices,
      colors,
      images,
    );

  return { run, matrices, colors, images };
}

describe("computeFood", () => {
  it("keeps only fog-visible food in the instance buffers and preserves order", () => {
    const state = makeState({ foods: [makeFood(1, 10, 10), makeFood(2, 60, 60)] });
    const { run, matrices } = createHarness();
    const camX = gridToWorldX(10, GRID_SIZE);
    const camY = gridToWorldY(10, GRID_SIZE);

    expect(
      run(state, null, {
        camX,
        camY,
        fogRadiusWorld: 50,
        showAll: false,
      }),
    ).toBe(1);
    expect(matrices[12]).toBeCloseTo(camX, 5);
    expect(matrices[13]).toBeCloseTo(camY, 5);

    expect(
      run(state, null, {
        camX,
        camY,
        fogRadiusWorld: 50,
        showAll: true,
      }),
    ).toBe(2);
    expect(matrices[12]).toBeCloseTo(gridToWorldX(10, GRID_SIZE), 5);
    expect(matrices[13]).toBeCloseTo(gridToWorldY(10, GRID_SIZE), 5);
    expect(matrices[16 + 12]).toBeCloseTo(gridToWorldX(60, GRID_SIZE), 5);
    expect(matrices[16 + 13]).toBeCloseTo(gridToWorldY(60, GRID_SIZE), 5);
  });

  it("interpolates positions from the last state and uses raw positions for new food", () => {
    const lastState = makeState({ foods: [makeFood(1, 10, 10)] });
    const state = makeState({ foods: [makeFood(1, 12, 10), makeFood(2, 20, 10)] });
    const { run, matrices } = createHarness();

    expect(run(state, lastState, { progress: 0.5 })).toBe(2);
    expect(matrices[12]).toBeCloseTo(230, 4);
    expect(matrices[13]).toBeCloseTo(-210, 4);
    expect(matrices[16 + 12]).toBeCloseTo(gridToWorldX(20, GRID_SIZE), 5);
    expect(matrices[16 + 13]).toBeCloseTo(gridToWorldY(10, GRID_SIZE), 5);
  });

  it("wraps food to the short path around a non-square map boundary", () => {
    const state = makeState({ width: 120, height: 80, foods: [makeFood(1, 119, 79)] });
    const { run, matrices } = createHarness();
    const camX = gridToWorldX(1, GRID_SIZE);
    const camY = gridToWorldY(1, GRID_SIZE);

    expect(
      run(state, null, {
        camX,
        camY,
        fogRadiusWorld: 100,
        showAll: false,
      }),
    ).toBe(1);

    // worldW = 2400, worldH = 1600: both axes take the 40-unit short path.
    expect(matrices[12]).toBeCloseTo(-10, 5);
    expect(matrices[13]).toBeCloseTo(10, 5);
  });

  it("uses the new position instead of lerping across a map seam", () => {
    const lastState = makeState({ foods: [makeFood(1, 98, 90)] });
    const state = makeState({ foods: [makeFood(1, 2, 10)] });
    const { run, matrices } = createHarness();

    expect(run(state, lastState, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(gridToWorldX(2, GRID_SIZE), 5);
    expect(matrices[13]).toBeCloseTo(gridToWorldY(10, GRID_SIZE), 5);
  });

  it("applies the 1.05 fog radius margin at the visibility edge", () => {
    const state = makeState({ foods: [makeFood(1, 0, 0)] });
    const { run } = createHarness();
    const wx = gridToWorldX(0, GRID_SIZE);
    const wy = gridToWorldY(0, GRID_SIZE);
    const boundary = Math.hypot(wx, wy) / 1.05;

    expect(
      run(state, null, {
        camX: 0,
        camY: 0,
        fogRadiusWorld: boundary * 1.01,
        showAll: false,
      }),
    ).toBe(1);

    expect(
      run(state, null, {
        camX: 0,
        camY: 0,
        fogRadiusWorld: boundary * 0.99,
        showAll: false,
      }),
    ).toBe(0);
  });

  it("pulls food toward the player head using the configured attraction", () => {
    const state = makeState({ foods: [makeFood(1, 11, 10)] });
    const { run, matrices } = createHarness();
    const headX = gridToWorldX(10, GRID_SIZE);
    const headY = gridToWorldY(10, GRID_SIZE);

    expect(
      run(state, null, {
        myPlayer: { body: [10, 10, 9, 10] },
        myHeadX: headX,
        myHeadY: headY,
        camX: 0,
        camY: 0,
        showAll: true,
      }),
    ).toBe(1);

    expect(matrices[12]).toBeCloseTo(214, 4);
    expect(matrices[13]).toBeCloseTo(-210, 5);
    expect(matrices[10]).toBeCloseTo(8, 5);
  });

  it("hides overlapping food and leaves food outside attraction radius untouched", () => {
    const headX = gridToWorldX(10, GRID_SIZE);
    const headY = gridToWorldY(10, GRID_SIZE);
    const myPlayer = { body: [10, 10, 9, 10] };

    const overlapping = makeState({ foods: [makeFood(1, 10, 10)] });
    const overlapHarness = createHarness();
    expect(
      overlapHarness.run(overlapping, null, {
        myPlayer,
        myHeadX: headX,
        myHeadY: headY,
        camX: headX,
        camY: headY,
        showAll: true,
      }),
    ).toBe(0);

    const farFood = makeState({ foods: [makeFood(1, 14, 10)] });
    const farHarness = createHarness();
    expect(
      farHarness.run(farFood, null, {
        myPlayer,
        myHeadX: headX,
        myHeadY: headY,
        camX: 0,
        camY: 0,
        showAll: true,
      }),
    ).toBe(1);
    expect(farHarness.matrices[12]).toBeCloseTo(gridToWorldX(14, GRID_SIZE), 5);
    expect(farHarness.matrices[13]).toBeCloseTo(gridToWorldY(10, GRID_SIZE), 5);
  });

  it("applies black-hole gravity and hides food inside the kill radius", () => {
    const blackHole: BlackHole = {
      id: "bh-1",
      x: 12,
      y: 10,
      pull_radius: 5,
      kill_radius: 0.5,
      current_scale: 1,
    };
    const state = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [blackHole],
      blackHolesEnabled: 1,
    });
    const { run, matrices } = createHarness();

    expect(run(state, null, { showAll: true, dt: 0.1 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(296.4, 4);
    expect(matrices[13]).toBeCloseTo(-210, 5);

    const lethal = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [{ ...blackHole, kill_radius: 3 }],
      blackHolesEnabled: 1,
    });
    expect(run(lethal, null, { showAll: true, dt: 0.1 })).toBe(0);
  });

  it("skips black-hole gravity when black holes are disabled or absent", () => {
    const blackHole: BlackHole = {
      id: "bh-1",
      x: 12,
      y: 10,
      pull_radius: 5,
      kill_radius: 0.5,
      current_scale: 1,
    };

    const disabled = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [blackHole],
      blackHolesEnabled: 0,
    });
    const disabledHarness = createHarness();
    expect(disabledHarness.run(disabled, null, { showAll: true })).toBe(1);
    expect(disabledHarness.matrices[12]).toBeCloseTo(gridToWorldX(10, GRID_SIZE), 5);

    const absent = makeState({ foods: [makeFood(1, 10, 10)], blackHolesEnabled: 1 });
    const absentHarness = createHarness();
    expect(absentHarness.run(absent, null, { showAll: true })).toBe(1);
    expect(absentHarness.matrices[12]).toBeCloseTo(gridToWorldX(10, GRID_SIZE), 5);
  });

  it("ignores dead and nearly invisible black holes", () => {
    const base: BlackHole = {
      id: "bh-1",
      x: 12,
      y: 10,
      pull_radius: 5,
      kill_radius: 0.5,
      current_scale: 1,
    };

    const dead = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [{ ...base, state: "dead" }],
      blackHolesEnabled: 1,
    });
    const deadHarness = createHarness();
    expect(deadHarness.run(dead, null, { showAll: true, dt: 0.1 })).toBe(1);
    expect(deadHarness.matrices[12]).toBeCloseTo(gridToWorldX(10, GRID_SIZE), 5);

    const tiny = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [{ ...base, current_scale: 0.01 }],
      blackHolesEnabled: 1,
    });
    const tinyHarness = createHarness();
    expect(tinyHarness.run(tiny, null, { showAll: true, dt: 0.1 })).toBe(1);
    expect(tinyHarness.matrices[12]).toBeCloseTo(gridToWorldX(10, GRID_SIZE), 5);
  });

  it("applies black-hole gravity when black_holes_enabled is undefined", () => {
    const state = makeState({
      foods: [makeFood(1, 10, 10)],
      blackHoles: [
        {
          id: "bh-1",
          x: 12,
          y: 10,
          pull_radius: 5,
          kill_radius: 0.5,
          current_scale: 1,
        },
      ],
    });
    const { run, matrices } = createHarness();

    expect(run(state, null, { showAll: true, dt: 0.1 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(296.4, 4);
    expect(matrices[13]).toBeCloseTo(-210, 5);
  });

  it("rebuilds the last-food cache on A -> B -> A switches", () => {
    const current = makeState({ foods: [makeFood(1, 12, 10)] });
    const stateA = makeState({ foods: [makeFood(1, 10, 10)] });
    const stateB = makeState({ foods: [makeFood(1, 20, 10)] });
    const { run, matrices } = createHarness();

    expect(run(current, stateA, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(230, 4);

    expect(run(current, stateB, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(330, 4);

    expect(run(current, stateA, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(230, 4);
  });

  it("clears the last-food cache on a null state and rebuilds it afterwards", () => {
    const current = makeState({ foods: [makeFood(1, 12, 10)] });
    const stateA = makeState({ foods: [makeFood(1, 10, 10)] });
    const { run, matrices } = createHarness();

    expect(run(current, stateA, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(230, 4);

    expect(run(current, null, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(250, 4);

    expect(run(current, stateA, { progress: 0.5 })).toBe(1);
    expect(matrices[12]).toBeCloseTo(230, 4);
  });
});
