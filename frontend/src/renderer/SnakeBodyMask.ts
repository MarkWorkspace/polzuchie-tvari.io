// ROLE: Top-down coverage mask of snake bodies for ground effects (contact shadow, grass trample).
// Does not light the scene, render shadows, choose colors or know gameplay.

import * as THREE from "three";
import { SNAKE_MASK_LAYER } from "./RenderConfig";
import { patchSnakeShadowMaterial } from "./shaders/snakeBody.glsl";

export const DEFAULT_BODY_MASK_RESOLUTION = 512;
export const DEFAULT_BODY_MASK_HALF_EXTENT = 180;
export const DEFAULT_BODY_MASK_BLUR_RADIUS = 4;
export const BODY_MASK_MIN_HALF_EXTENT = 180;
export const BODY_MASK_MAX_HALF_EXTENT = 600;
export const BODY_MASK_VIEW_MARGIN = 1.1;
export const BODY_MASK_MIN_RESOLUTION = 256;
export const BODY_MASK_MAX_RESOLUTION = 1024;

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
 * cheap while the tap spacing is derived from world units, so the mask edge
 * does not swim when the perspective camera zooms.
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

export interface BodyMaskFrame {
  texture: THREE.Texture;
  x: number;
  y: number;
  halfExtent: number;
}

export interface SnakeBodyMaskOptions {
  /** Square mask resolution at the 180-unit reference box. Defaults to 512. */
  resolution?: number;
  /** Initial half of the square world-space coverage box. Defaults to 180. */
  halfExtent?: number;
  /** Gaussian support half-width in world units. Defaults to 4. */
  blurRadiusWorld?: number;
  /** World-space z of the ground plane. Defaults to -2. */
  groundZ?: number;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Keeps an accidental huge option from allocating an enormous mask. */
function sanitizeResolution(value: number | undefined): number {
  return Math.min(2048, Math.max(64, Math.round(positiveOr(value, DEFAULT_BODY_MASK_RESOLUTION))));
}

function floorPowerOfTwo(value: number): number {
  return 2 ** Math.floor(Math.log2(Math.max(1, value)));
}

/**
 * Half extent of the body-mask box that covers the camera's ground view cone
 * with a 10% margin. Clamped so spectator/free cameras cannot allocate a huge
 * box.
 */
export function bodyMaskHalfExtent(
  distance: number,
  fovDegrees: number,
  margin = BODY_MASK_VIEW_MARGIN,
): number {
  const viewDistance = Number.isFinite(distance) && distance > 0 ? distance : 0;
  const fov = Number.isFinite(fovDegrees) ? Math.min(179, Math.max(1, fovDegrees)) : 50;
  const safeMargin = Number.isFinite(margin) && margin > 0 ? margin : BODY_MASK_VIEW_MARGIN;
  const raw = 2 * viewDistance * Math.tan((fov * Math.PI) / 360) * safeMargin;
  return Math.min(BODY_MASK_MAX_HALF_EXTENT, Math.max(BODY_MASK_MIN_HALF_EXTENT, raw));
}

/**
 * Resolution for the adaptive box. The preset value is the resolution at the
 * 180-unit reference box, so 512 matches the 0.703 world-unit texel the 0.7
 * target asks for; low keeps the same ratio at a coarser 256 tier. Resolution
 * is rounded down to a power of two to keep the targets stable while zooming.
 */
export function bodyMaskResolution(
  halfExtent: number,
  baseResolution = DEFAULT_BODY_MASK_RESOLUTION,
): number {
  const extent = positiveOr(halfExtent, DEFAULT_BODY_MASK_HALF_EXTENT);
  const base = Math.min(
    2048,
    Math.max(64, Math.round(positiveOr(baseResolution, DEFAULT_BODY_MASK_RESOLUTION))),
  );
  const referenceTexel = 0.7 * (DEFAULT_BODY_MASK_RESOLUTION / base);
  const raw = (extent * 2) / referenceTexel;
  const clamped = Math.min(
    BODY_MASK_MAX_RESOLUTION,
    Math.max(BODY_MASK_MIN_RESOLUTION, Math.round(raw)),
  );
  return floorPowerOfTwo(clamped);
}

/** World units covered by one mask texel. */
export function bodyMaskTexelSize(halfExtent: number, resolution: number): number {
  const extent = positiveOr(halfExtent, DEFAULT_BODY_MASK_HALF_EXTENT);
  const texels = Math.round(positiveOr(resolution, DEFAULT_BODY_MASK_RESOLUTION));
  return (extent * 2) / Math.max(1, texels);
}

/** Converts a world-space blur radius (Gaussian support) to mask texels. */
export function bodyMaskWorldRadiusToTexels(
  radiusWorld: number,
  halfExtent: number,
  resolution: number,
): number {
  const radius = positiveOr(radiusWorld, 0);
  return radius / bodyMaskTexelSize(halfExtent, resolution);
}

/** UV offset for one Gaussian tap, independent of the viewport size. */
export function bodyMaskBlurStepUv(
  radiusWorld: number,
  halfExtent: number,
  resolution: number,
  tapsPerSide = BLUR_TAPS_PER_SIDE,
): number {
  const texels = bodyMaskWorldRadiusToTexels(radiusWorld, halfExtent, resolution);
  const taps = Math.max(1, Math.floor(positiveOr(tapsPerSide, BLUR_TAPS_PER_SIDE)));
  const texelsPerAxis = Math.max(
    1,
    Math.round(positiveOr(resolution, DEFAULT_BODY_MASK_RESOLUTION)),
  );
  return texels / taps / texelsPerAxis;
}

/**
 * Keeps the mask box strictly smaller than one map period, so the nine
 * toroidal wrap copies of the snake can never put a second silhouette inside
 * the box. Maps are normally much larger than 360 world units, which leaves the
 * requested extent untouched.
 */
export function clampBodyMaskHalfExtent(
  halfExtent: number,
  mapWidth: number,
  mapHeight: number,
): number {
  // Allocation-free: this helper runs from the per-frame target update.
  let half = positiveOr(halfExtent, DEFAULT_BODY_MASK_HALF_EXTENT);
  if (Number.isFinite(mapWidth) && mapWidth > 0) {
    half = Math.min(half, Math.max(1, mapWidth / 2 - 1));
  }
  if (Number.isFinite(mapHeight) && mapHeight > 0) {
    half = Math.min(half, Math.max(1, mapHeight / 2 - 1));
  }
  return half;
}

/**
 * Shared body silhouette pass. The mask keeps the exact rounded ribbon contour
 * and a soft blurred edge; ground effects consume that soft edge and decide how
 * far to spread it (offset, falloff, tint).
 */
export class SnakeBodyMask {
  private readonly previousClearColor = new THREE.Color();
  private readonly groundZ: number;
  private readonly blurRadiusWorld: number;
  private readonly maskCamera: THREE.OrthographicCamera;
  private readonly maskMaterial: THREE.MeshBasicMaterial;
  private readonly blurMaterial: THREE.ShaderMaterial;
  private readonly fullscreenScene: THREE.Scene;
  private readonly fullscreenCamera: THREE.OrthographicCamera;
  private readonly fullscreenMesh: THREE.Mesh;

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

  constructor(options: SnakeBodyMaskOptions = {}) {
    this.groundZ = Number.isFinite(options.groundZ) ? (options.groundZ as number) : -2;
    this.baseResolution = sanitizeResolution(options.resolution);
    this.requestedHalfExtent = positiveOr(options.halfExtent, DEFAULT_BODY_MASK_HALF_EXTENT);
    this.halfExtent = clampBodyMaskHalfExtent(
      this.requestedHalfExtent,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    this.resolution = bodyMaskResolution(this.halfExtent, this.baseResolution);
    this.blurRadiusWorld = positiveOr(options.blurRadiusWorld, DEFAULT_BODY_MASK_BLUR_RADIUS);

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

    this.fullscreenScene = new THREE.Scene();
    this.fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fullscreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMaterial);
    this.fullscreenMesh.frustumCulled = false;
    this.fullscreenScene.add(this.fullscreenMesh);

    this.updateProjection();
    this.setTarget(0, 0);
  }

  /** Camera-relative world point the mask is centered on. */
  public setTarget(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.targetX = x;
    this.targetY = y;
    this.maskCamera.position.set(x, y, this.groundZ + 100);
  }

  /** Soft body silhouette, centered on the current target. */
  public getFrame(): BodyMaskFrame {
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
    this.applyRequestedHalfExtent(bodyMaskHalfExtent(distance, fovDegrees));
  }

  /** Rasterize the body mask and blur it. Must run before the composer render. */
  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
    this.renderMask(renderer, scene);
    this.renderBlur(renderer);
  }

  public dispose(): void {
    this.fullscreenMesh.geometry.dispose();
    this.maskMaterial.dispose();
    this.blurMaterial.dispose();
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
    this.maskTarget.texture.name = "SnakeBodyMask.Mask";
    this.blurTargetA = new THREE.WebGLRenderTarget(resolution, resolution, common);
    this.blurTargetA.texture.name = "SnakeBodyMask.BlurH";
    this.blurTargetB = new THREE.WebGLRenderTarget(resolution, resolution, common);
    this.blurTargetB.texture.name = "SnakeBodyMask.BlurV";
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
    const effective = clampBodyMaskHalfExtent(requested, this.mapWidth, this.mapHeight);
    const materialChange =
      Math.abs(effective - this.halfExtent) >= Math.max(2, this.halfExtent * 0.01);
    if (!force && !materialChange) return;

    this.halfExtent = effective;
    const nextResolution = bodyMaskResolution(effective, this.baseResolution);
    if (nextResolution !== this.resolution) {
      this.resolution = nextResolution;
      this.disposeTargets();
      this.createTargets(nextResolution);
      this.blurMaterial.uniforms.uSource.value = this.maskTarget.texture;
    }
    this.updateProjection();
  }

  private updateProjection(): void {
    const camera = this.maskCamera;
    camera.left = -this.halfExtent;
    camera.right = this.halfExtent;
    camera.top = this.halfExtent;
    camera.bottom = -this.halfExtent;
    camera.updateProjectionMatrix();

    this.blurStepUv = bodyMaskBlurStepUv(this.blurRadiusWorld, this.halfExtent, this.resolution);
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
      this.maskCamera.layers.set(SNAKE_MASK_LAYER);
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
