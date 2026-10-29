// ROLE: Rasterizes the snake body silhouette into a small mask texture so bloom can be suppressed on the ribbon itself. No gameplay, no lighting setup, no post effects.
import * as THREE from "three";
import { BLOOM_MASK_LAYER } from "./RenderConfig";

/**
 * Half resolution keeps the mask edge tight against the ribbon; bilinear
 * upsampling feathers the last couple of pixels.
 */
export const BLOOM_MASK_SCALE = 2;

export interface BloomMaskSize {
  width: number;
  height: number;
}

/** Mask target size in device pixels, clamped so the target is never empty. */
export function bloomMaskSize(width: number, height: number, pixelRatio: number): BloomMaskSize {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return {
    width: Math.max(1, Math.round((width * ratio) / BLOOM_MASK_SCALE)),
    height: Math.max(1, Math.round((height * ratio) / BLOOM_MASK_SCALE)),
  };
}

/**
 * Renders the meshes on BLOOM_MASK_LAYER into an offscreen target with their
 * real materials, so the mask inherits the body shader's rounded head/tail
 * discard and matches the visible silhouette exactly. Coverage lives in the
 * alpha channel: opaque body fragments write 1, the discarded contour stays 0.
 */
export class BloomMaskRenderer {
  public readonly texture: THREE.Texture;
  private readonly target: THREE.WebGLRenderTarget;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.name = "BloomMask";
    this.target.texture.generateMipmaps = false;
    this.texture = this.target.texture;
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    const size = bloomMaskSize(width, height, pixelRatio);
    this.target.setSize(size.width, size.height);
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
  ): void {
    const previousClearColor = new THREE.Color();
    renderer.getClearColor(previousClearColor);
    const previousClearAlpha = renderer.getClearAlpha();
    const previousShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const previousBackground = scene.background;
    const previousCameraMask = camera.layers.mask;

    try {
      renderer.setRenderTarget(this.target);
      // Alpha is the coverage channel, so the cleared backdrop must be transparent.
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.autoUpdate = false;
      scene.background = null;
      camera.layers.set(BLOOM_MASK_LAYER);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
    } finally {
      camera.layers.mask = previousCameraMask;
      scene.background = previousBackground;
      renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.setRenderTarget(null);
    }
  }

  public dispose(): void {
    this.target.dispose();
  }
}
