// ROLE: Rasterizes the snake body silhouette into a small mask texture so bloom can be suppressed on the ribbon itself. No gameplay, no lighting, no post effects.
import * as THREE from "three";
import { BLOOM_MASK_LAYER } from "./RenderConfig";

/** The mask is quarter resolution; bilinear upsampling feathers the silhouette edge. */
export const BLOOM_MASK_SCALE = 4;

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
 * Draws every mesh on BLOOM_MASK_LAYER as flat white into an offscreen target.
 * Post-processing samples it to keep the additive bloom off the body core while
 * the halo around the ribbon stays untouched.
 */
export class BloomMaskRenderer {
  public readonly texture: THREE.Texture;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: false,
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
    const previousOverrideMaterial = scene.overrideMaterial;
    const previousCameraMask = camera.layers.mask;

    try {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 1);
      renderer.shadowMap.autoUpdate = false;
      scene.background = null;
      scene.overrideMaterial = this.material;
      camera.layers.set(BLOOM_MASK_LAYER);
      renderer.clear(true, true, false);
      renderer.render(scene, camera);
    } finally {
      camera.layers.mask = previousCameraMask;
      scene.overrideMaterial = previousOverrideMaterial;
      scene.background = previousBackground;
      renderer.shadowMap.autoUpdate = previousShadowAutoUpdate;
      renderer.setClearColor(previousClearColor, previousClearAlpha);
      renderer.setRenderTarget(null);
    }
  }

  public dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
