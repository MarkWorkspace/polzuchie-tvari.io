// ROLE: World-space contact shadow for the snake ribbon: a top-down coverage
// mask of the body, two separable Gaussian passes and one soft ground quad.
// Does not cast shadow maps, light the scene or know about gameplay.

import * as THREE from "three";
import { OVERLAY_LAYER, RenderLayer, SNAKE_SHADOW_LAYER } from "./RenderConfig";
import { patchSnakeShadowMaterial } from "./shaders/snakeBody.glsl";

export const DEFAULT_CONTACT_SHADOW_RESOLUTION = 512;
export const DEFAULT_CONTACT_SHADOW_HALF_EXTENT = 180;
export const DEFAULT_CONTACT_SHADOW_BLUR_RADIUS = 4;
export const DEFAULT_CONTACT_SHADOW_OPACITY = 0.5;
/** Shadow tint. Pure black reads as a hole under a bright sun. */
export const DEFAULT_CONTACT_SHADOW_COLOR = 0x1a2635;
/** The quad floats just above the ground plane to avoid z-fighting. */
export const CONTACT_SHADOW_GROUND_OFFSET = 0.05;

export const CONTACT_SHADOW_MIN_HALF_EXTENT = 180;
export const CONTACT_SHADOW_MAX_HALF_EXTENT = 600;
export const CONTACT_SHADOW_VIEW_MARGIN = 1.1;
export const CONTACT_SHADOW_MIN_RESOLUTION = 256;
export const CONTACT_SHADOW_MAX_RESOLUTION = 1024;
/** Key light rig and ribbon height used for the cast-shadow parallax. */
export const CONTACT_SHADOW_KEY_LIGHT = { x: 240, y: 180, z: 270 } as const;
export const CONTACT_SHADOW_BODY_HEIGHT = 2;

/** 9 taps total: one centre tap plus four taps on each side. */
const BLUR_TAPS_PER_SIDE = 4;

const FULLSCREEN_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Symmetric 9-tap Gaussian (sigma ~2 taps). Two passes keep the footprint
 * cheap while the tap spacing is derived from world units, so the shadow does
 * not swim when the perspective camera zooms.
 */
const BLUR_FRAGMENT_SHADER = `
  uniform sampler2D uSource;
  uniform vec2 uStep;
  varying vec2 vUv;

  void main() {
    vec4 sum = texture2D(uSource, vUv) * 0.2270270270;
    sum += (texture2D(uSource, vUv + uStep) + texture2D(uSource, vUv - uStep)) * 0.1945945946;
    sum += (texture2D(uSource, vUv + uStep * 2.0) + texture2D(uSource, vUv - uStep * 2.0)) * 0.1216216216;
    sum += (texture2D(uSource, vUv + uStep * 3.0) + texture2D(uSource, vUv - uStep * 3.0)) * 0.0540540541;
    sum += (texture2D(uSource, vUv + uStep * 4.0) + texture2D(uSource, vUv - uStep * 4.0)) * 0.0162162162;
    gl_FragColor = sum;
  }
`;

export interface ContactShadowQuadPose {
  x: number;
  y: number;
  z: number;
  size: number;
}

export interface SnakeContactShadowOptions {
  /** Square mask resolution at the 180-unit reference box. Defaults to 512. */
  resolution?: number;
  /** Initial half of the square world-space coverage box. Defaults to 180. */
  halfExtent?: number;
  /** Gaussian support half-width in world units. Defaults to 3. */
  blurRadiusWorld?: number;
  /** Composite opacity at full coverage. Defaults to 0.7. */
  opacity?: number;
  /**
   * Key-light ground parallax. The mask camera is shifted by this vector, so
   * the silhouette lands on the anti-light side of the body. Defaults to
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

/** Keeps an accidental huge option from allocating an enormous mask. */
function sanitizeResolution(value: number | undefined): number {
  return Math.min(
    2048,
    Math.max(64, Math.round(positiveOr(value, DEFAULT_CONTACT_SHADOW_RESOLUTION))),
  );
}

function floorPowerOfTwo(value: number): number {
  return 2 ** Math.floor(Math.log2(Math.max(1, value)));
}

export interface ContactShadowLightOffset {
  x: number;
  y: number;
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

/**
 * Half extent of the shadow box that covers the camera's ground view cone with
 * a 10% margin. Clamped so spectator/free cameras cannot allocate a huge box.
 */
export function contactShadowHalfExtent(
  distance: number,
  fovDegrees: number,
  margin = CONTACT_SHADOW_VIEW_MARGIN,
): number {
  const viewDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
  const fov = Number.isFinite(fovDegrees) ? Math.min(179, Math.max(1, fovDegrees)) : 50;
  const safeMargin = Number.isFinite(margin) && margin > 0 ? margin : CONTACT_SHADOW_VIEW_MARGIN;
  const raw = 2 * viewDistance * Math.tan((fov * Math.PI) / 360) * safeMargin;
  return Math.min(CONTACT_SHADOW_MAX_HALF_EXTENT, Math.max(CONTACT_SHADOW_MIN_HALF_EXTENT, raw));
}

/**
 * Resolution for the adaptive box. The preset value is the resolution at the
 * 180-unit reference box, so 512 matches the 0.703 world-unit texel the 0.7
 * target asks for; low keeps the same ratio at a coarser 256 tier. Resolution
 * is rounded down to a power of two to keep the targets stable while zooming.
 */
export function contactShadowResolution(
  halfExtent: number,
  baseResolution = DEFAULT_CONTACT_SHADOW_RESOLUTION,
): number {
  const extent = positiveOr(halfExtent, DEFAULT_CONTACT_SHADOW_HALF_EXTENT);
  const base = Math.min(
    2048,
    Math.max(64, Math.round(positiveOr(baseResolution, DEFAULT_CONTACT_SHADOW_RESOLUTION))),
  );
  const referenceTexel = 0.7 * (DEFAULT_CONTACT_SHADOW_RESOLUTION / base);
  const raw = (extent * 2) / referenceTexel;
  const clamped = Math.min(
    CONTACT_SHADOW_MAX_RESOLUTION,
    Math.max(CONTACT_SHADOW_MIN_RESOLUTION, Math.round(raw)),
  );
  return floorPowerOfTwo(clamped);
}

/** World units covered by one mask texel. */
export function contactTexelSize(halfExtent: number, resolution: number): number {
  const extent = positiveOr(halfExtent, DEFAULT_CONTACT_SHADOW_HALF_EXTENT);
  const texels = Math.round(positiveOr(resolution, DEFAULT_CONTACT_SHADOW_RESOLUTION));
  return (extent * 2) / Math.max(1, texels);
}

/** Converts a world-space blur radius (Gaussian support) to mask texels. */
export function contactWorldRadiusToTexels(
  radiusWorld: number,
  halfExtent: number,
  resolution: number,
): number {
  const radius = positiveOr(radiusWorld, 0);
  return radius / contactTexelSize(halfExtent, resolution);
}

/** UV offset for one Gaussian tap, independent of the viewport size. */
export function contactBlurStepUv(
  radiusWorld: number,
  halfExtent: number,
  resolution: number,
  tapsPerSide = BLUR_TAPS_PER_SIDE,
): number {
  const texels = contactWorldRadiusToTexels(radiusWorld, halfExtent, resolution);
  const taps = Math.max(1, Math.floor(positiveOr(tapsPerSide, BLUR_TAPS_PER_SIDE)));
  const texelsPerAxis = Math.max(
    1,
    Math.round(positiveOr(resolution, DEFAULT_CONTACT_SHADOW_RESOLUTION)),
  );
  return texels / taps / texelsPerAxis;
}

/** Size of the square composite quad in world units. */
export function contactQuadSize(halfExtent: number): number {
  return positiveOr(halfExtent, DEFAULT_CONTACT_SHADOW_HALF_EXTENT) * 2;
}

/**
 * Keeps the shadow box strictly smaller than one map period, so the nine
 * toroidal wrap copies of the snake can never put a second silhouette inside
 * the box. Maps are normally much larger than 360 world units, which leaves the
 * requested extent untouched.
 */
export function clampContactHalfExtent(
  halfExtent: number,
  mapWidth: number,
  mapHeight: number,
): number {
  // Allocation-free: this helper runs from the per-frame target update.
  let half = positiveOr(halfExtent, DEFAULT_CONTACT_SHADOW_HALF_EXTENT);
  if (Number.isFinite(mapWidth) && mapWidth > 0) {
    half = Math.min(half, Math.max(1, mapWidth / 2 - 1));
  }
  if (Number.isFinite(mapHeight) && mapHeight > 0) {
    half = Math.min(half, Math.max(1, mapHeight / 2 - 1));
  }
  return half;
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
 * One contact shadow for the snake. The mask pass uses the body's own contour
 * discard via `patchSnakeShadowMaterial`, so the soft silhouette matches the
 * ribbon's rounded head and tail without a shadow map.
 */
export class SnakeContactShadow {
  private readonly scene: THREE.Scene;
  private readonly blurRadiusWorld: number;
  private readonly lightOffsetX: number;
  private readonly lightOffsetY: number;
  private readonly groundZ: number;
  private readonly maskCamera: THREE.OrthographicCamera;
  private readonly maskMaterial: THREE.MeshBasicMaterial;
  private readonly blurMaterial: THREE.ShaderMaterial;
  private readonly compositeMaterial: THREE.MeshBasicMaterial;
  private readonly quad: THREE.Mesh;
  private readonly fullscreenScene: THREE.Scene;
  private readonly fullscreenCamera: THREE.OrthographicCamera;
  private readonly fullscreenMesh: THREE.Mesh;
  private readonly previousClearColor = new THREE.Color();

  private maskTarget!: THREE.WebGLRenderTarget;
  private blurTargetA!: THREE.WebGLRenderTarget;
  private blurTargetB!: THREE.WebGLRenderTarget;
  private baseResolution: number;
  private requestedHalfExtent: number;
  private mapWidth = Number.POSITIVE_INFINITY;
  private mapHeight = Number.POSITIVE_INFINITY;
  private resolution: number;
  private halfExtent: number;
  private blurStepUv = 0;
  private targetX = 0;
  private targetY = 0;

  constructor(scene: THREE.Scene, options: SnakeContactShadowOptions = {}) {
    this.scene = scene;
    this.baseResolution = sanitizeResolution(options.resolution);
    this.requestedHalfExtent = positiveOr(options.halfExtent, DEFAULT_CONTACT_SHADOW_HALF_EXTENT);
    this.halfExtent = clampContactHalfExtent(
      this.requestedHalfExtent,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    this.resolution = contactShadowResolution(this.halfExtent, this.baseResolution);
    this.blurRadiusWorld = positiveOr(options.blurRadiusWorld, DEFAULT_CONTACT_SHADOW_BLUR_RADIUS);
    this.groundZ = options.groundZ ?? -2;
    const lightOffset = options.lightOffset ?? DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET;
    this.lightOffsetX = Number.isFinite(lightOffset.x)
      ? lightOffset.x
      : DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.x;
    this.lightOffsetY = Number.isFinite(lightOffset.y)
      ? lightOffset.y
      : DEFAULT_CONTACT_SHADOW_LIGHT_OFFSET.y;

    this.createTargets(this.resolution);

    this.maskCamera = new THREE.OrthographicCamera(
      -this.halfExtent,
      this.halfExtent,
      this.halfExtent,
      -this.halfExtent,
      1,
      400,
    );
    this.maskCamera.up.set(0, 1, 0);
    this.maskCamera.position.set(0, 0, this.groundZ + 100);
    this.maskCamera.lookAt(0, 0, this.groundZ);

    // White opaque coverage patched with the ribbon's rounded contour discard.
    this.maskMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });
    this.maskMaterial.onBeforeCompile = (shader) => {
      patchSnakeShadowMaterial(shader);
    };

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSource: { value: this.maskTarget.texture },
        uStep: { value: new THREE.Vector2() },
      },
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: BLUR_FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });

    const opacity = options.opacity ?? DEFAULT_CONTACT_SHADOW_OPACITY;
    this.compositeMaterial = new THREE.MeshBasicMaterial({
      color: DEFAULT_CONTACT_SHADOW_COLOR,
      map: this.blurTargetB.texture,
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
    // The quad is a ground-baked term, not geometry: keep it out of the normal
    // pass so a future SSAO re-enable cannot pick up its 0.05-unit depth step.
    this.quad.layers.set(OVERLAY_LAYER);
    this.scene.add(this.quad);

    this.fullscreenScene = new THREE.Scene();
    this.fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fullscreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMaterial);
    this.fullscreenMesh.frustumCulled = false;
    this.fullscreenScene.add(this.fullscreenMesh);

    this.updateProjection();
    this.setTarget(0, 0);
  }

  /**
   * Camera-relative world point the main camera looks at. The mask camera is
   * shifted by the key-light parallax while the composite quad stays on the
   * target, so the silhouette lands on the anti-light side instead of hiding
   * underneath the opaque ribbon.
   */
  public setTarget(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.targetX = x;
    this.targetY = y;
    this.maskCamera.position.set(x + this.lightOffsetX, y + this.lightOffsetY, this.groundZ + 100);
    this.quad.position.set(x, y, this.groundZ + CONTACT_SHADOW_GROUND_OFFSET);
  }

  /**
   * The blurred mask and its world-square mapping, so opaque grass can tint
   * blades inside the shadow instead of hiding the ground decal. Texture and
   * target are one frame behind by construction; the blur hides that.
   */
  public getFrame(): { texture: THREE.Texture; x: number; y: number; halfExtent: number } {
    return {
      texture: this.blurTargetB.texture,
      x: this.targetX,
      y: this.targetY,
      halfExtent: this.halfExtent,
    };
  }

  /**
   * Shrinks the box below one toroidal map period when the server map is small.
   * Normal 100x100-cell maps keep the adaptive extent.
   */
  public setMapSize(mapWidth: number, mapHeight: number): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.applyRequestedHalfExtent(this.requestedHalfExtent);
  }

  /** Base resolution from the active quality preset; keeps the adaptive ratio. */
  public setBaseResolution(resolution: number): void {
    const next = sanitizeResolution(resolution);
    if (next === this.baseResolution) return;
    this.baseResolution = next;
    this.applyRequestedHalfExtent(this.requestedHalfExtent, true);
  }

  /** Recomputes the box from the perspective camera's view cone. */
  public setViewDistance(distance: number, fovDegrees: number): void {
    this.applyRequestedHalfExtent(contactShadowHalfExtent(distance, fovDegrees));
  }

  /** Rasterize the mask and blur it. Must run before the main composer render. */
  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.renderMask(renderer, scene);
    this.renderBlur(renderer);
  }

  public dispose(): void {
    this.scene.remove(this.quad);
    this.quad.geometry.dispose();
    this.fullscreenMesh.geometry.dispose();
    this.maskMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.disposeTargets();
  }

  private createTargets(resolution: number): void {
    const common = {
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    };
    this.maskTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      ...common,
      // The mask keeps the nearest body fragment per texel.
      depthBuffer: true,
    });
    this.maskTarget.texture.name = "SnakeContactShadow.Mask";
    this.blurTargetA = new THREE.WebGLRenderTarget(resolution, resolution, common);
    this.blurTargetA.texture.name = "SnakeContactShadow.BlurH";
    this.blurTargetB = new THREE.WebGLRenderTarget(resolution, resolution, common);
    this.blurTargetB.texture.name = "SnakeContactShadow.BlurV";
  }

  private disposeTargets(): void {
    this.maskTarget.dispose();
    this.blurTargetA.dispose();
    this.blurTargetB.dispose();
  }

  /**
   * Applies the requested adaptive extent. Small frame-to-frame changes are
   * ignored so the render targets are not resized while the camera zooms; a
   * resolution change still has to happen at the power-of-two boundary.
   */
  private applyRequestedHalfExtent(requested: number, force = false): void {
    this.requestedHalfExtent = requested;
    const effective = clampContactHalfExtent(requested, this.mapWidth, this.mapHeight);
    const materialChange =
      Math.abs(effective - this.halfExtent) >= Math.max(2, this.halfExtent * 0.01);
    if (!force && !materialChange) return;

    this.halfExtent = effective;
    const nextResolution = contactShadowResolution(effective, this.baseResolution);
    if (nextResolution !== this.resolution) {
      this.resolution = nextResolution;
      this.disposeTargets();
      this.createTargets(nextResolution);
      this.blurMaterial.uniforms.uSource.value = this.maskTarget.texture;
      this.compositeMaterial.map = this.blurTargetB.texture;
      this.compositeMaterial.needsUpdate = true;
    }
    this.updateProjection();
  }

  private updateProjection(): void {
    const camera = this.maskCamera;
    camera.position.set(
      this.targetX + this.lightOffsetX,
      this.targetY + this.lightOffsetY,
      this.groundZ + 100,
    );
    camera.left = -this.halfExtent;
    camera.right = this.halfExtent;
    camera.top = this.halfExtent;
    camera.bottom = -this.halfExtent;
    camera.updateProjectionMatrix();

    const size = contactQuadSize(this.halfExtent);
    this.quad.scale.set(size, size, 1);
    this.blurStepUv = contactBlurStepUv(this.blurRadiusWorld, this.halfExtent, this.resolution);
  }

  private renderMask(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const previousBackground = scene.background;
    const previousOverrideMaterial = scene.overrideMaterial;
    const previousCameraMask = this.maskCamera.layers.mask;
    renderer.getClearColor(this.previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();

    try {
      renderer.setRenderTarget(this.maskTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.clear(true, true, false);
      // The ortho pass must not trigger another shadow-map render.
      renderer.shadowMap.autoUpdate = false;
      scene.background = null;
      scene.overrideMaterial = this.maskMaterial;
      this.maskCamera.layers.set(SNAKE_SHADOW_LAYER);
      renderer.render(scene, this.maskCamera);
    } finally {
      this.maskCamera.layers.mask = previousCameraMask;
      scene.overrideMaterial = previousOverrideMaterial;
      scene.background = previousBackground;
      renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
      renderer.autoClear = previousAutoClear;
      renderer.setClearColor(this.previousClearColor, previousClearAlpha);
      renderer.setRenderTarget(previousTarget);
    }
  }

  private renderBlur(renderer: THREE.WebGLRenderer): void {
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const step = this.blurMaterial.uniforms.uStep.value as THREE.Vector2;

    try {
      renderer.autoClear = false;

      this.blurMaterial.uniforms.uSource.value = this.maskTarget.texture;
      step.set(this.blurStepUv, 0);
      renderer.setRenderTarget(this.blurTargetA);
      renderer.render(this.fullscreenScene, this.fullscreenCamera);

      this.blurMaterial.uniforms.uSource.value = this.blurTargetA.texture;
      step.set(0, this.blurStepUv);
      renderer.setRenderTarget(this.blurTargetB);
      renderer.render(this.fullscreenScene, this.fullscreenCamera);
    } finally {
      renderer.autoClear = previousAutoClear;
      renderer.setRenderTarget(previousTarget);
    }
  }
}
