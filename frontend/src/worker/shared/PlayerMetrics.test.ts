// ROLE: Regression tests for snake size/fog math using body segment counts.
import { describe, expect, it } from "vitest";
import {
  computeFogRadiusWorld,
  computeHeadRadiusWorld,
  getBodySegmentCount,
} from "./PlayerMetrics";

const state = {
  server_snake: {
    start_length: 9,
    base_head_radius: 0.1,
    score_thickness_scale: 0.0002,
  },
  server_visual: {
    min_fog_radius: 900,
    fog_score_expansion_coeff: 0.5,
  },
} as any;

describe("PlayerMetrics", () => {
  it("counts FlatArray body floats as segments", () => {
    expect(getBodySegmentCount([0, 0, 1, 1, 2, 2])).toBe(3);
    expect(getBodySegmentCount([], 9)).toBe(0);
    expect(getBodySegmentCount(undefined, 9)).toBe(9);
  });

  it("does not double the start snake radius", () => {
    const startBody = new Array(9 * 2).fill(0);
    expect(computeHeadRadiusWorld(state, startBody, 20)).toBeCloseTo(2.0);
  });

  it("uses segment gain, not float count, for fog", () => {
    const startBody = new Array(9 * 2).fill(0);
    const grownBody = new Array(19 * 2).fill(0);
    expect(computeFogRadiusWorld(state, startBody, false)).toBe(900);
    expect(computeFogRadiusWorld(state, grownBody, false)).toBe(950);
  });

  it("returns infinite fog when requested", () => {
    expect(computeFogRadiusWorld(state, [], true)).toBe(1_000_000);
  });
});
