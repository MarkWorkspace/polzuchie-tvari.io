// ROLE: Unit tests for the contact-shadow consumer: light offset, quad pose and
// the soft default look. Body-mask math lives in SnakeBodyMask.test.ts.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DEFAULT_BODY_MASK_HALF_EXTENT, type SnakeBodyMask } from "./SnakeBodyMask";
import {
  CONTACT_SHADOW_GROUND_OFFSET,
  contactQuadPose,
  contactQuadSize,
  contactShadowLightOffset,
  DEFAULT_CONTACT_SHADOW_COLOR,
  DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET,
  DEFAULT_CONTACT_SHADOW_OPACITY,
  SnakeContactShadow,
} from "./SnakeContactShadow";

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
    expect(contactQuadSize(0)).toBe(DEFAULT_BODY_MASK_HALF_EXTENT * 2);
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
    // Only the composite quad is shifted by this vector; the body mask stays
    // centered on the camera target, so the silhouette moves -offset (anti-light).
    expect(contactShadowLightOffset(300, 0, 300, 2)).toEqual({ x: 2, y: 0 });
    expect(contactShadowLightOffset(0, 300, 300, 2)).toEqual({ x: 0, y: 2 });
  });

  it("falls back to zero for an invalid light-height setup", () => {
    expect(contactShadowLightOffset(160, 120, 0, 2)).toEqual({ x: 0, y: 0 });
    expect(contactShadowLightOffset(Number.NaN, 120, 300, 2)).toEqual({ x: 0, y: 0 });
    expect(contactShadowLightOffset(160, 120, 300, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe("default shadow look", () => {
  it("keeps one soft, sun-tinted term instead of a black hole", () => {
    expect(DEFAULT_CONTACT_SHADOW_OPACITY).toBe(0.5);
    expect(DEFAULT_CONTACT_SHADOW_COLOR).toBe(0x1a2635);
  });
});

describe("shadow quad placement", () => {
  it("moves the body-aligned mask to the anti-light side", () => {
    const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    const bodyMask = {
      getFrame: () => ({ texture, x: 0, y: 0, halfExtent: 180 }),
    } as unknown as SnakeBodyMask;
    const scene = new THREE.Scene();
    const shadow = new SnakeContactShadow(scene, bodyMask, { groundZ: -2 });

    shadow.setTarget(120, -75);
    shadow.update();

    const quad = scene.children[0] as THREE.Mesh;
    expect(quad.position.x).toBeCloseTo(120 - DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.x, 10);
    expect(quad.position.y).toBeCloseTo(-75 - DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.y, 10);
    expect(quad.scale.x).toBe(360);
    shadow.dispose();
  });
});
