// ROLE: Soft ground contact shadow that consumes the shared snake body mask.
// Does not render the mask, light the scene, choose gameplay or know about grass.

import * as THREE from "three";
import { OVERLAY_LAYER, RenderLayer } from "./RenderConfig";
import { DEFAULT_BODY_MASK_HALF_EXTENT, type SnakeBodyMask } from "./SnakeBodyMask";

export const DEFAULT_CONTACT_SHADOW_OPACITY = 0.5;
/** Shadow tint. Pure black reads as a hole under a bright sun. */
export const DEFAULT_CONTACT_SHADOW_COLOR = 0x1a2635;
/** The quad floats just above the ground plane to avoid z-fighting. */
export const CONTACT_SHADOW_GROUND_OFFSET = 0.05;
/** Key light rig and ribbon height used for the cast-shadow parallax. */
export const CONTACT_SHADOW_KEY_LIGHT = { x: 240, y: 180, z: 270 } as const;
export const CONTACT_SHADOW_BODY_HEIGHT = 2;

export interface ContactShadowLightOffset {
  x: number;
  y: number;
}

export interface ContactShadowQuadPose {
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface SnakeContactShadowOptions {
  /** Composite opacity at full coverage. Defaults to 0.5. */
  opacity?: number;
  /**
   * Key-light ground parallax. The quad is shifted by this vector, so the
   * silhouette lands on the anti-light side of the body. Defaults to
   * (160, 120, 300) * 2 body height -> (1.067, 0.8).
   */
  lightOffset?: ContactShadowLightOffset;
  /** World-space z of the ground plane. Defaults to -2, matching SceneManager. */
  groundZ?: number;
  /** Render order between the ground (-2) and objects (>= 0). */
  renderOrder?: number;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Ground displacement of a shadow cast by a light at (lightX, lightY, lightZ)
 * for a body `bodyHeight` above the ground. The light sits on the positive
 * side, so the shadow itself lands on the opposite (anti-light) side.
 */
export function contactShadowLightOffset(
  lightX: number,
  lightY: number,
  lightZ: number,
  bodyHeight: number,
): ContactShadowLightOffset {
  if (
    !Number.isFinite(lightX) ||
    !Number.isFinite(lightY) ||
    !Number.isFinite(lightZ) ||
    lightZ <= 0
  ) {
    return { x: 0, y: 0 };
  }
  const height = Number.isFinite(bodyHeight) && bodyHeight > 0 ? bodyHeight : 0;
  return { x: (lightX / lightZ) * height, y: (lightY / lightZ) * height };
}

export const DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET: ContactShadowLightOffset =
  contactShadowLightOffset(
    CONTACT_SHADOW_KEY_LIGHT.x,
    CONTACT_SHADOW_KEY_LIGHT.y,
    CONTACT_SHADOW_KEY_LIGHT.z,
    CONTACT_SHADOW_BODY_HEIGHT,
  );

/** Size of the square composite quad in world units. */
export function contactQuadSize(halfExtent: number): number {
  return positiveOr(halfExtent, DEFAULT_BODY_MASK_HALF_EXTENT) * 2;
}

/** Quad pose for a camera-relative target. The plane faces +Z, so no rotation. */
export function contactQuadPose(
  targetX: number,
  targetY: number,
  groundZ: number,
  halfExtent: number,
): ContactShadowQuadPose {
  return {
    x: targetX,
    y: targetY,
    z: groundZ + CONTACT_SHADOW_GROUND_OFFSET,
    size: contactQuadSize(halfExtent),
  };
}

/**
 * Ground shadow consumer. The body mask is rendered once per frame by
 * `SnakeBodyMask`; this class only positions the soft quad and binds the
 * blurred silhouette.
 */
export class SnakeContactShadow {
  private readonly scene: THREE.Scene;
  private readonly bodyMask: SnakeBodyMask;
  private readonly lightOffsetX: number;
  private readonly lightOffsetY: number;
  private readonly groundZ: number;
  private readonly compositeMaterial: THREE.MeshBasicMaterial;
  private readonly quad: THREE.Mesh;
  private targetX = 0;
  private targetY = 0;

  constructor(
    scene: THREE.Scene,
    bodyMask: SnakeBodyMask,
    options: SnakeContactShadowOptions = {},
  ) {
    this.scene = scene;
    this.bodyMask = bodyMask;
    this.groundZ = options.groundZ ?? -2;
    const lightOffset = options.lightOffset ?? DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET;
    this.lightOffsetX = Number.isFinite(lightOffset.x)
      ? lightOffset.x
      : DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.x;
    this.lightOffsetY = Number.isFinite(lightOffset.y)
      ? lightOffset.y
      : DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.y;

    const opacity = options.opacity ?? DEFAULT_CONTACT_SHADOW_OPACITY;
    this.compositeMaterial = new THREE.MeshBasicMaterial({
      color: DEFAULT_CONTACT_SHADOW_COLOR,
      map: bodyMask.getFrame().texture,
      transparent: true,
      opacity: Math.min(1, Math.max(0, opacity)),
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.compositeMaterial);
    this.quad.renderOrder = options.renderOrder ?? RenderLayer.Shadow;
    this.quad.frustumCulled = false;
    // The quad is a ground-baked term, not geometry, so it stays out of the base
    // layer and dedicated passes that rasterize real objects cannot pick it up.
    this.quad.layers.set(OVERLAY_LAYER);
    this.scene.add(this.quad);
  }

  /**
   * Camera-relative world point the main camera looks at. The quad is shifted
   * by the key-light parallax, so the silhouette lands on the anti-light side
   * instead of hiding underneath the opaque ribbon.
   */
  public setTarget(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.targetX = x;
    this.targetY = y;
  }

  /** Sync quad pose, scale and blurred texture with the shared body mask. */
  public update(): void {
    const frame = this.bodyMask.getFrame();
    // The mask is body-aligned; move the quad to the anti-light side to keep
    // the same cast-shadow parallax the old offset mask camera produced.
    const pose = contactQuadPose(
      this.targetX - this.lightOffsetX,
      this.targetY - this.lightOffsetY,
      this.groundZ,
      frame.halfExtent,
    );
    this.quad.position.set(pose.x, pose.y, pose.z);
    this.quad.scale.set(pose.size, pose.size, 1);

    const nextMap = frame.texture;
    if (this.compositeMaterial.map !== nextMap) {
      this.compositeMaterial.map = nextMap;
      this.compositeMaterial.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.scene.remove(this.quad);
    this.quad.geometry.dispose();
    this.compositeMaterial.dispose();
  }
}
