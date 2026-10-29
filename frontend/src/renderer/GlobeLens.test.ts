// ROLE: Unit tests for the pure spherical globe projection, inverse warp and overscan helpers.
import { describe, expect, it } from "vitest";
import {
  GLOBE_SPHERE,
  type GlobeParams,
  globeOverscan,
  globeSampleUv,
  globeScreenUv,
  globeWarpScale,
} from "./GlobeLens";

function cornerRadius(aspect: number): number {
  return 0.5 * Math.sqrt(aspect * aspect + 1);
}

function globeParams(aspect: number, sphere = GLOBE_SPHERE): GlobeParams {
  return {
    aspect,
    sphere,
    overscan: globeOverscan(sphere),
  };
}

const ASPECTS = [1, 16 / 9];
const ROUND_TRIP_UVS = [
  [0, 0],
  [0, 0.5],
  [0, 1],
  [0.5, 0],
  [0.5, 1],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [0.5, 0.5],
  [0.25, 0.25],
  [0.75, 0.75],
  [0.13, 0.62],
  [0.87, 0.37],
  [0.42, 0.91],
];

describe("GlobeLens", () => {
  it("uses identity scale at the center and the overscan scale at the rim", () => {
    for (const aspect of ASPECTS) {
      const rim = cornerRadius(aspect);

      expect(globeWarpScale(0, aspect, GLOBE_SPHERE)).toBe(1);
      expect(globeWarpScale(rim, aspect, GLOBE_SPHERE)).toBeCloseTo(
        globeOverscan(GLOBE_SPHERE),
        12,
      );
      expect(globeWarpScale(rim / 2, aspect, GLOBE_SPHERE)).toBeGreaterThan(
        globeWarpScale(0, aspect, GLOBE_SPHERE),
      );
      expect(globeWarpScale(rim, aspect, GLOBE_SPHERE)).toBeGreaterThan(
        globeWarpScale(rim / 2, aspect, GLOBE_SPHERE),
      );
    }
  });

  it("matches asin(u) / u and grows monotonically with u", () => {
    const values = [1e-4, 0.2, 0.4, 0.6, 0.7, 0.8, 0.9, 1];

    for (const u of values) {
      expect(globeOverscan(u)).toBeCloseTo(Math.asin(u) / u, 12);
    }
    for (let i = 1; i < values.length; i += 1) {
      expect(globeOverscan(values[i])).toBeGreaterThan(globeOverscan(values[i - 1]));
    }
  });

  it("keeps overscan independent of aspect and sane", () => {
    const square = globeOverscan(GLOBE_SPHERE);
    const widescreen = globeOverscan(GLOBE_SPHERE);

    expect(widescreen).toBe(square);
    expect(square).toBeGreaterThan(1.1);
    expect(square).toBeLessThan(1.12);
  });

  it("grows the rim-to-center derivative ratio with u", () => {
    const aspect = 16 / 9;
    const rim = cornerRadius(aspect);
    const values = [0.2, 0.4, 0.6, 0.7, 0.8, 0.9];
    const ratios = values.map((u) => globeWarpScale(rim, aspect, u) / globeWarpScale(0, aspect, u));

    for (let i = 1; i < ratios.length; i += 1) {
      expect(ratios[i]).toBeGreaterThan(ratios[i - 1]);
    }
    expect(ratios[ratios.length - 1]).toBeCloseTo(globeOverscan(0.9), 12);
  });

  it("flattens to identity for tiny u", () => {
    const aspect = 16 / 9;
    const sphere = 1e-6;
    const rim = cornerRadius(aspect);
    const params = globeParams(aspect, sphere);

    for (const r of [0, rim * 0.25, rim * 0.5, rim]) {
      expect(globeWarpScale(r, aspect, sphere)).toBeCloseTo(1, 10);
    }
    expect(globeOverscan(sphere)).toBeCloseTo(1, 10);

    const screen = globeScreenUv(0.2, 0.8, params);
    expect(screen.x).toBeCloseTo(0.2, 5);
    expect(screen.y).toBeCloseTo(0.8, 5);
  });

  it("round-trips source uvs through the inverse and forward warp", () => {
    let maxError = 0;

    for (const aspect of ASPECTS) {
      const params = globeParams(aspect);
      for (const [sourceX, sourceY] of ROUND_TRIP_UVS) {
        const screen = globeScreenUv(sourceX, sourceY, params);
        const source = globeSampleUv(screen.x, screen.y, params);
        maxError = Math.max(maxError, Math.abs(source.x - sourceX), Math.abs(source.y - sourceY));
      }
    }

    expect(maxError).toBeLessThan(1e-4);
  });

  it("leaves the center fixed in both directions", () => {
    for (const aspect of ASPECTS) {
      const params = globeParams(aspect);

      expect(globeScreenUv(0.5, 0.5, params).x).toBeCloseTo(0.5, 10);
      expect(globeScreenUv(0.5, 0.5, params).y).toBeCloseTo(0.5, 10);
      expect(globeSampleUv(0.5, 0.5, params).x).toBeCloseTo(0.5, 10);
      expect(globeSampleUv(0.5, 0.5, params).y).toBeCloseTo(0.5, 10);
    }
  });

  it("keeps the radial direction of warped points", () => {
    const params = globeParams(16 / 9);

    expect(globeScreenUv(0.25, 0.5, params).x).toBeLessThan(0.5);
    expect(globeScreenUv(0.75, 0.5, params).x).toBeGreaterThan(0.5);
    expect(globeScreenUv(0.5, 0.25, params).y).toBeLessThan(0.5);
    expect(globeScreenUv(0.5, 0.75, params).y).toBeGreaterThan(0.5);
  });

  it("keeps source samples inside [0, 1] at the exact screen corners", () => {
    for (const aspect of ASPECTS) {
      const params = globeParams(aspect);
      for (const [x, y] of [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]) {
        const source = globeSampleUv(x, y, params);
        expect(source.x).toBeGreaterThanOrEqual(0);
        expect(source.x).toBeLessThanOrEqual(1);
        expect(source.y).toBeGreaterThanOrEqual(0);
        expect(source.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
