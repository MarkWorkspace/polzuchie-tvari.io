// ROLE: Sun/hemisphere/fill light rig, snake-light pool, shadow-map quality and per-frame light tracking.
// Never creates a renderer and does not own renderer.shadowMap.enabled/type.
import * as THREE from "three";
import type { QualityPreset } from "./RenderQuality";
import { SnakeLightPool } from "./SnakeLightPool";

/**
 * Sunny-day rig. The camera looks down at ~55 degrees and the ground fills the
 * frame, so there is no sky dome to light the scene: the daylight read comes
 * from this warm key, the cool sky/ground hemisphere and the aerial fog.
 * Elevation is atan(270 / 300) ~= 42 degrees, which makes shadows long enough
 * to read without stretching them across the whole screen.
 */
export const SUN_OFFSET = { x: 240, y: 180, z: 270 } as const;
export const SUN_COLOR = 0xfff2dc;
export const SUN_INTENSITY = 4.2;
export const HEMI_SKY_COLOR = 0xb9d4ff;
export const HEMI_GROUND_COLOR = 0x7a6242;
export const HEMI_INTENSITY = 1.7;
export const FILL_COLOR = 0x9fc2ff;
export const FILL_INTENSITY = 0.12;

/**
 * The visible fog radius is 900+ units; shadowing all of it at 2048 texels
 * would be very coarse. Cover the useful near-field instead.
 */
export function shadowCameraExtent(fogRadiusWorld: number | undefined): number {
  const fogRadius = Math.min(fogRadiusWorld ?? 300, 2000);
  return Math.min(900, Math.max(300, fogRadius * 0.8));
}

export class SceneLighting {
  private readonly scene: THREE.Scene;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly fillLight: THREE.DirectionalLight;
  private readonly snakeLights: SnakeLightPool;

  constructor(scene: THREE.Scene, preset: QualityPreset) {
    this.scene = scene;

    // Pale blue sky bounce + dry-grass soil bounce. With no environment map
    // this hemisphere term is the whole ambient budget, so it stays warm/cool
    // rather than neutral grey.
    this.hemiLight = new THREE.HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    this.dirLight.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
    this.dirLight.castShadow = preset.shadows;
    this.configureShadowQuality(preset);

    // Shadowless cool rim from the anti-sun side. It sculpts fruit and
    // tombstones without adding another shadow-map render pass.
    this.fillLight = new THREE.DirectionalLight(FILL_COLOR, FILL_INTENSITY);
    this.fillLight.position.set(-SUN_OFFSET.x, -SUN_OFFSET.y, 220);
    this.fillLight.castShadow = false;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);

    this.snakeLights = new SnakeLightPool(this.scene, preset.snakeLights);
  }

  public setQuality(preset: QualityPreset): void {
    this.dirLight.castShadow = preset.shadows;
    this.configureShadowQuality(preset);
    this.snakeLights.setCount(preset.snakeLights);
  }

  /** Re-applies the preset after a context restore drops the shadow map. */
  public restore(preset: QualityPreset): void {
    this.setQuality(preset);
  }

  public update(
    activePlayers: Parameters<SnakeLightPool["update"]>[0],
    camX: number,
    camY: number,
    fogRadiusWorld: number | undefined,
  ): void {
    this.snakeLights.update(activePlayers, camX, camY);

    // Keep both light rigs centered on the camera. The key light is offset so
    // shadows and fruit shading read directionally instead of top-down flat.
    this.dirLight.position.set(camX + SUN_OFFSET.x, camY + SUN_OFFSET.y, SUN_OFFSET.z);
    this.dirLight.target.position.set(camX, camY, 0);
    this.dirLight.target.updateMatrixWorld();
    this.fillLight.position.set(camX - SUN_OFFSET.x, camY - SUN_OFFSET.y, 220);
    this.fillLight.target.position.set(camX, camY, 0);
    this.fillLight.target.updateMatrixWorld();

    const d = shadowCameraExtent(fogRadiusWorld);
    const cam = this.dirLight.shadow.camera;
    if (cam.left !== -d || cam.right !== d || cam.top !== d || cam.bottom !== -d) {
      cam.left = -d;
      cam.right = d;
      cam.top = d;
      cam.bottom = -d;
      cam.updateProjectionMatrix();
    }
  }

  public destroy(): void {
    this.snakeLights.destroy();
    this.scene.remove(this.hemiLight);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.dirLight.target);
    this.scene.remove(this.fillLight);
    this.scene.remove(this.fillLight.target);
  }

  private configureShadowQuality(preset: QualityPreset): void {
    // Three r184 deprecated PCFSoftShadowMap; PCF plus a radius gives a
    // similar soft edge with a smaller optional tap count.
    const shadow = this.dirLight.shadow;
    shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    shadow.map?.dispose();
    shadow.map = null;
    shadow.bias = -0.0003;
    shadow.normalBias = 0.2;
    shadow.radius = preset.shadowRadius;

    const d = 900;
    shadow.camera.left = -d;
    shadow.camera.right = d;
    shadow.camera.top = d;
    shadow.camera.bottom = -d;
    shadow.camera.near = 1;
    shadow.camera.far = 2000;
    shadow.camera.updateProjectionMatrix();
  }
}
