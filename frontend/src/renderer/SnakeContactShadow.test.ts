// ROLE: Unit tests for the pure world-space contact-shadow math: texel size,
// world-space blur radius, quad pose and the toroidal wrap guard.

import { describe, expect, it } from "vitest";
import {
  CONTACT_SHADOW_GROUND_OFFSET,
  CONTACT_SHADOW_MAX_HALF_EXTENT,
  CONTACT_SHADOW_MIN_HALF_EXTENT,
  clampContactHalfExtent,
  contactBlurStepUv,
  contactQuadPose,
  contactQuadSize,
  contactShadowHalfExtent,
  contactShadowLightOffset,
  contactShadowResolution,
  contactTexelSize,
  contactWorldRadiusToTexels,
  DEFAULT_CONTACT_SHADOW_BLUR_RADIUS,
  DEFAULT_CONTACT_SHADOW_COLOR,
  DEFAULT_CONTACT_SHADOW_HALF_EXTENT,
  DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET,
  DEFAULT_CONTACT_SHADOW_OPACITY,
  DEFAULT_CONTACT_SHADOW_RESOLUTION,
} from "./SnakeContactShadow";

describe("contactTexelSize", () => {
  it("maps the full world-space box onto the mask resolution", () => {
    // 360 world units over 512 texels.
    expect(contactTexelSize(180, 512)).toBeCloseTo(360 / 512, 10);
    expect(contactTexelSize(180, 256)).toBeCloseTo(360 / 256, 10);
  });

  it("falls back to sane defaults for invalid input", () => {
    expect(contactTexelSize(0, 0)).toBeCloseTo(
      (DEFAULT_CONTACT_SHADOW_HALF_EXTENT * 2) / DEFAULT_CONTACT_SHADOW_RESOLUTION,
      10,
    );
    expect(contactTexelSize(Number.NaN, 512)).toBeCloseTo(360 / 512, 10);
  });
});

describe("contactWorldRadiusToTexels", () => {
  it("converts a world-space blur radius into mask texels", () => {
    const texels = contactWorldRadiusToTexels(2, 180, 512);
    expect(texels).toBeCloseTo(2 / (360 / 512), 10);
    // The kernel is constant in world units, not in screen pixels.
    expect(texels * contactTexelSize(180, 512)).toBeCloseTo(2, 10);
  });

  it("uses the same world radius at every resolution", () => {
    const low = contactWorldRadiusToTexels(2, 180, 256);
    const high = contactWorldRadiusToTexels(2, 180, 1024);
    expect(high).toBeCloseTo(low * 4, 10);
    expect(low * contactTexelSize(180, 256)).toBeCloseTo(2, 10);
    expect(high * contactTexelSize(180, 1024)).toBeCloseTo(2, 10);
  });
});

describe("contactBlurStepUv", () => {
  it("spreads four taps per side across the world-space radius", () => {
    const step = contactBlurStepUv(2, 180, 512);
    const texelsPerSide = step * 512;
    expect(texelsPerSide * 4).toBeCloseTo(contactWorldRadiusToTexels(2, 180, 512), 10);
    expect(texelsPerSide * 4 * contactTexelSize(180, 512)).toBeCloseTo(2, 10);
  });

  it("does not depend on the viewport or zoom", () => {
    // Only extent + resolution + world radius participate, so a camera zoom
    // cannot change the kernel.
    expect(contactBlurStepUv(2, 180, 512)).toBe(contactBlurStepUv(2, 180, 512));
  });
});

describe("contact quad pose", () => {
  it("centers a square quad on the target, slightly above the ground", () => {
    const pose = contactQuadPose(120, -75, -2, 180);
    expect(pose.x).toBe(120);
    expect(pose.y).toBe(-75);
    expect(pose.size).toBe(360);
    expect(pose.z).toBeCloseTo(-2 + CONTACT_SHADOW_GROUND_OFFSET, 10);
    expect(pose.z).toBeGreaterThan(-2);
  });

  it("keeps the quad square at different extents", () => {
    expect(contactQuadSize(180)).toBe(360);
    expect(contactQuadSize(90)).toBe(180);
    expect(contactQuadSize(0)).toBe(DEFAULT_CONTACT_SHADOW_HALF_EXTENT * 2);
  });
});

describe("directional light offset", () => {
  it("uses the key-light parallax for a body 2 units above the ground", () => {
    const offset = contactShadowLightOffset(240, 180, 270, 2);
    expect(offset.x).toBeCloseTo(16 / 9, 12);
    expect(offset.y).toBeCloseTo(4 / 3, 12);
    expect(DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.x).toBeCloseTo(16 / 9, 12);
    expect(DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.y).toBeCloseTo(4 / 3, 12);
  });

  it("keeps the offset a single vector, not a second shadow", () => {
    // Only the mask camera is shifted by this vector; the composite quad stays
    // on the ground target, so the silhouette moves -offset (anti-light).
    expect(contactShadowLightOffset(300, 0, 300, 2)).toEqual({ x: 2, y: 0 });
    expect(contactShadowLightOffset(0, 300, 300, 2)).toEqual({ x: 0, y: 2 });
  });

  it("falls back to zero for an invalid light-height setup", () => {
    expect(contactShadowLightOffset(160, 120, 0, 2)).toEqual({ x: 0, y: 0 });
    expect(contactShadowLightOffset(Number.NaN, 120, 300, 2)).toEqual({ x: 0, y: 0 });
    expect(contactShadowLightOffset(160, 120, 300, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("adaptive extent", () => {
  it("fits the camera ground cone with a 10% margin", () => {
    const expected = 2 * 214 * Math.tan((25 * Math.PI) / 180) * 1.1;
    expect(contactShadowHalfExtent(214, 50)).toBeCloseTo(expected, 10);
    expect(contactShadowHalfExtent(214, 50)).toBeGreaterThan(180);
    expect(contactShadowHalfExtent(214, 50)).toBeLessThan(600);
  });

  it("clamps close and zoomed-out cameras", () => {
    expect(contactShadowHalfExtent(10, 50)).toBe(CONTACT_SHADOW_MIN_HALF_EXTENT);
    expect(contactShadowHalfExtent(5000, 70)).toBe(CONTACT_SHADOW_MAX_HALF_EXTENT);
    expect(contactShadowHalfExtent(0, 50)).toBe(CONTACT_SHADOW_MIN_HALF_EXTENT);
    expect(contactShadowHalfExtent(Number.NaN, Number.NaN)).toBe(CONTACT_SHADOW_MIN_HALF_EXTENT);
  });

  it("grows monotonically with distance", () => {
    const near = contactShadowHalfExtent(200, 50);
    const mid = contactShadowHalfExtent(400, 50);
    const far = contactShadowHalfExtent(800, 50);
    expect(mid).toBeGreaterThan(near);
    expect(far).toBeGreaterThan(mid);
  });
});

describe("adaptive resolution", () => {
  it("keeps the default view at 512 and low at 256", () => {
    expect(contactShadowResolution(220, 512)).toBe(512);
    expect(contactShadowResolution(220, 256)).toBe(256);
    expect(contactShadowResolution(150, 512)).toBe(256);
    expect(contactShadowResolution(150, 256)).toBe(256);
  });

  it("scales the target resolution with the box, rounded down to a power of two", () => {
    expect(contactShadowResolution(180, 512)).toBe(512);
    expect(contactShadowResolution(360, 512)).toBe(1024);
    expect(contactShadowResolution(600, 512)).toBe(1024);
    expect(contactShadowResolution(400, 256)).toBe(512);
    expect(contactShadowResolution(600, 256)).toBe(512);
  });

  it("clamps the result to [256, 1024]", () => {
    expect(contactShadowResolution(1, 512)).toBe(256);
    expect(contactShadowResolution(5000, 512)).toBe(1024);
    expect(contactShadowResolution(5000, 256)).toBe(1024);
    for (const resolution of [
      contactShadowResolution(180, 512),
      contactShadowResolution(400, 512),
      contactShadowResolution(600, 256),
    ]) {
      expect(Math.log2(resolution) % 1).toBe(0);
    }
  });

  it("matches the 0.7 world-unit texel target at the reference box for 512", () => {
    expect(contactTexelSize(180, contactShadowResolution(180, 512))).toBeCloseTo(360 / 512, 10);
  });
});

describe("default strength and softness", () => {
  it("keeps one soft, sun-tinted term instead of a black hole", () => {
    expect(DEFAULT_CONTACT_SHADOW_BLUR_RADIUS).toBe(4);
    expect(DEFAULT_CONTACT_SHADOW_OPACITY).toBe(0.5);
    expect(DEFAULT_CONTACT_SHADOW_COLOR).toBe(0x1a2635);
  });
});

describe("toroidal wrap guard", () => {
  it("keeps the default extent on a normal 100x100-cell map (2000 world units)", () => {
    expect(clampContactHalfExtent(180, 2000, 2000)).toBe(180);
    expect(contactQuadSize(clampContactHalfExtent(180, 2000, 2000))).toBeLessThan(2000);
  });

  it("shrinks the box below one map period on small maps", () => {
    // A wrap copy is offset by a full map dimension, so the box must stay
    // strictly smaller than the map on both axes.
    const half = clampContactHalfExtent(180, 300, 200);
    expect(half).toBe(99);
    expect(contactQuadSize(half)).toBeLessThan(200);
  });

  it("ignores missing map dimensions", () => {
    expect(clampContactHalfExtent(180, 0, 0)).toBe(180);
    expect(clampContactHalfExtent(180, Number.NaN, Number.POSITIVE_INFINITY)).toBe(180);
  });
});
