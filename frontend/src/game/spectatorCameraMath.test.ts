// ROLE: Unit tests for the spectator camera toroidal helpers.
import { describe, expect, it } from "vitest";
import { shortestToroidalDelta, wrapWithin } from "./spectatorCameraMath";

describe("shortestToroidalDelta", () => {
  it("takes the short path across the map border", () => {
    expect(shortestToroidalDelta(1990, 10, 2000)).toBe(20);
    expect(shortestToroidalDelta(10, 1990, 2000)).toBe(-20);
  });

  it("keeps ordinary deltas unchanged", () => {
    expect(shortestToroidalDelta(100, 160, 2000)).toBe(60);
    expect(shortestToroidalDelta(160, 100, 2000)).toBe(-60);
  });

  it("handles wrapped camera positions far outside the map", () => {
    expect(shortestToroidalDelta(2015, 15, 2000)).toBeCloseTo(0);
    expect(shortestToroidalDelta(-1985, 15, 2000)).toBeCloseTo(0);
  });
});

describe("wrapWithin", () => {
  it("wraps x into the map range", () => {
    expect(wrapWithin(2015, 2000)).toBe(15);
    expect(wrapWithin(-5, 2000)).toBe(1995);
    expect(wrapWithin(15, 2000)).toBe(15);
  });

  it("wraps negative y into [-height, 0)", () => {
    expect(wrapWithin(15, 2000, -2000)).toBe(-1985);
    expect(wrapWithin(-2005, 2000, -2000)).toBe(-5);
    expect(wrapWithin(-400, 2000, -2000)).toBe(-400);
  });
});
