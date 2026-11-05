// ROLE: Unit tests for the shared snake body-mask math: adaptive extent/resolution,
// texel size, world-space blur and the toroidal wrap guard.

import { describe, expect, it } from "vitest";
import {
  BODY_MASK_MAX_HALF_EXTENT,
  BODY_MASK_MIN_HALF_EXTENT,
  bodyMaskBlurStepUv,
  bodyMaskHalfExtent,
  bodyMaskResolution,
  bodyMaskTexelSize,
  bodyMaskWorldRadiusToTexels,
  clampBodyMaskHalfExtent,
  DEFAULT_BODY_MASK_BLUR_RADIUS,
  DEFAULT_BODY_MASK_HALF_EXTENT,
  DEFAULT_BODY_MASK_RESOLUTION,
} from "./SnakeBodyMask";

describe("bodyMaskTexelSize", () => {
  it("maps the full world-space box onto the mask resolution", () => {
    // 360 world units over 512 texels.
    expect(bodyMaskTexelSize(180, 512)).toBeCloseTo(360 / 512, 10);
    expect(bodyMaskTexelSize(180, 256)).toBeCloseTo(360 / 256, 10);
  });

  it("falls back to sane defaults for invalid input", () => {
    expect(bodyMaskTexelSize(0, 0)).toBeCloseTo(
      (DEFAULT_BODY_MASK_HALF_EXTENT * 2) / DEFAULT_BODY_MASK_RESOLUTION,
      10,
    );
    expect(bodyMaskTexelSize(Number.NaN, 512)).toBeCloseTo(360 / 512, 10);
  });
});

describe("bodyMaskWorldRadiusToTexels", () => {
  it("converts a world-space blur radius into mask texels", () => {
    const texels = bodyMaskWorldRadiusToTexels(2, 180, 512);
    expect(texels).toBeCloseTo(2 / (360 / 512), 10);
    // The kernel is constant in world units, not in screen pixels.
    expect(texels * bodyMaskTexelSize(180, 512)).toBeCloseTo(2, 10);
  });

  it("uses the same world radius at every resolution", () => {
    const low = bodyMaskWorldRadiusToTexels(2, 180, 256);
    const high = bodyMaskWorldRadiusToTexels(2, 180, 1024);
    expect(high).toBeCloseTo(low * 4, 10);
    expect(low * bodyMaskTexelSize(180, 256)).toBeCloseTo(2, 10);
    expect(high * bodyMaskTexelSize(180, 1024)).toBeCloseTo(2, 10);
  });
});

describe("bodyMaskBlurStepUv", () => {
  it("spreads four taps per side across the world-space radius", () => {
    const step = bodyMaskBlurStepUv(2, 180, 512);
    const texelsPerSide = step * 512;
    expect(texelsPerSide * 4).toBeCloseTo(bodyMaskWorldRadiusToTexels(2, 180, 512), 10);
    expect(texelsPerSide * 4 * bodyMaskTexelSize(180, 512)).toBeCloseTo(2, 10);
  });

  it("does not depend on the viewport or zoom", () => {
    // Only extent + resolution + world radius participate, so a camera zoom
    // cannot change the kernel.
    expect(bodyMaskBlurStepUv(2, 180, 512)).toBe(bodyMaskBlurStepUv(2, 180, 512));
  });
});

describe("adaptive body-mask extent", () => {
  it("fits the camera ground cone with a 10% margin", () => {
    const expected = 2 * 214 * Math.tan((25 * Math.PI) / 180) * 1.1;
    expect(bodyMaskHalfExtent(214, 50)).toBeCloseTo(expected, 10);
    expect(bodyMaskHalfExtent(214, 50)).toBeGreaterThan(180);
    expect(bodyMaskHalfExtent(214, 50)).toBeLessThan(600);
  });

  it("clamps close and zoomed-out cameras", () => {
    expect(bodyMaskHalfExtent(10, 50)).toBe(BODY_MASK_MIN_HALF_EXTENT);
    expect(bodyMaskHalfExtent(5000, 70)).toBe(BODY_MASK_MAX_HALF_EXTENT);
    expect(bodyMaskHalfExtent(0, 50)).toBe(BODY_MASK_MIN_HALF_EXTENT);
    expect(bodyMaskHalfExtent(Number.NaN, Number.NaN)).toBe(BODY_MASK_MIN_HALF_EXTENT);
  });

  it("grows monotonically with distance", () => {
    const near = bodyMaskHalfExtent(200, 50);
    const mid = bodyMaskHalfExtent(400, 50);
    const far = bodyMaskHalfExtent(800, 50);
    expect(mid).toBeGreaterThan(near);
    expect(far).toBeGreaterThan(mid);
  });
});

describe("adaptive body-mask resolution", () => {
  it("keeps the default view at 512 and low at 256", () => {
    expect(bodyMaskResolution(220, 512)).toBe(512);
    expect(bodyMaskResolution(220, 256)).toBe(256);
    expect(bodyMaskResolution(150, 512)).toBe(256);
    expect(bodyMaskResolution(150, 256)).toBe(256);
  });

  it("scales the target resolution with the box, rounded down to a power of two", () => {
    expect(bodyMaskResolution(180, 512)).toBe(512);
    expect(bodyMaskResolution(360, 512)).toBe(1024);
    expect(bodyMaskResolution(600, 512)).toBe(1024);
    expect(bodyMaskResolution(400, 256)).toBe(512);
    expect(bodyMaskResolution(600, 256)).toBe(512);
  });

  it("clamps the result to [256, 1024]", () => {
    expect(bodyMaskResolution(1, 512)).toBe(256);
    expect(bodyMaskResolution(5000, 512)).toBe(1024);
    expect(bodyMaskResolution(5000, 256)).toBe(1024);
    for (const resolution of [
      bodyMaskResolution(180, 512),
      bodyMaskResolution(400, 512),
      bodyMaskResolution(600, 256),
    ]) {
      expect(Math.log2(resolution) % 1).toBe(0);
    }
  });

  it("matches the 0.7 world-unit texel target at the reference box for 512", () => {
    expect(bodyMaskTexelSize(180, bodyMaskResolution(180, 512))).toBeCloseTo(360 / 512, 10);
  });
});

describe("default body-mask softness", () => {
  it("keeps a single soft edge independent of shadow color or opacity", () => {
    expect(DEFAULT_BODY_MASK_BLUR_RADIUS).toBe(4);
  });
});

describe("toroidal wrap guard", () => {
  it("keeps the default extent on a normal 100x100-cell map (2000 world units)", () => {
    expect(clampBodyMaskHalfExtent(180, 2000, 2000)).toBe(180);
  });

  it("shrinks the box below one map period on small maps", () => {
    // A wrap copy is offset by a full map dimension, so the box must stay
    // strictly smaller than the map on both axes.
    const half = clampBodyMaskHalfExtent(180, 300, 200);
    expect(half).toBe(99);
    expect(half * 2).toBeLessThan(200);
  });

  it("ignores missing map dimensions", () => {
    expect(clampBodyMaskHalfExtent(180, 0, 0)).toBe(180);
    expect(clampBodyMaskHalfExtent(180, Number.NaN, Number.POSITIVE_INFINITY)).toBe(180);
  });
});
