// ROLE: Rasterizes a render layer's silhouette into a small alpha target (bloom mask, contact occlusion). No gameplay, no lighting setup, no post effects.
import * as THREE from "three";

export interface SilhouetteSize {
  width: number;
  height: number;
}

/** Target size in device pixels for a silhouette at the given downscale. */
export function silhouetteSize(
  width: number,
  height: number,
  pixelRatio: number,
  scale: number,
): SilhouetteSize {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const divisor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    width: Math.max(1, Math.round((width * ratio) / divisor)),
    height: Math.max(1, Math.round((height * ratio) / divisor)),
  };
}

/**
 * Renders the meshes on one render layer with their real materials, so the mask
 * inherits shader-side silhouette changes (rounded head/tail, portal alpha) and
 * matches what the camera sees. Coverage lives in the alpha channel: opaque
 * fragments write 1, discarded or cleared pixels stay 0.
 */
export class SilhouetteRenderer {
  public readonly texture: THREE.Texture;
  private readonly target: THREE.WebGLRenderTarget;
  private readonly layer: number;
  private readonly scale: number;
  private targetWidth = 1;
  private targetHeight = 1;

  constructor(layer: number, scale: number) {
    this.layer = layer;
    this.scale = scale;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.target.texture.name = `Silhouette.L${layer}`;
    this.target.texture.generateMipmaps = false;
    this.texture = this.target.texture;
  }

  public resize(width: number, height: number, pixelRatio: number): void {
    const size = silhouetteSize(width, height, pixelRatio, this.scale);
    this.targetWidth = size.width;
    this.targetHeight = size.height;
    this.target.setSize(size.width, size.height);
  }

  /** Current target size in texels, for shader-side sampling offsets. */
  public size(): SilhouetteSize {
    return { width: this.targetWidth, height: this.targetHeight };
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
      camera.layers.set(this.layer);
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
