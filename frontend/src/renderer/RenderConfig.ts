// ROLE: Global render configuration, layers, and material factories. Does not contain game logic.

import * as THREE from 'three';

/**
 * Strict ordering for all meshes in the scene to prevent Z-fighting and depth issues.
 * Lower numbers render first. Negative layers are usually backgrounds/shadows.
 * Opaque objects usually ignore renderOrder, but transparent objects rely on it.
 */
export const RenderLayer = {
  Ground: -2,
  Shadow: -1,
  Opaque: 0,      // Default for standard opaque objects (e.g. Tombstones)
  Food: 1,
  Particle: 2,
  SnakeBody: 3,
  SnakeEyes: 4,
  SnakePupils: 5,
  PortalDisk: 6,
  PortalRing: 7,
  PortalGlow: 8,
  GravityMesh: 9,
  BlackHoleRing: 10,
  BlackHoleCore: 11,
  DebugGrid: 20,
  DebugCollision: 21,
} as const;

export type RenderLayer = typeof RenderLayer[keyof typeof RenderLayer];

export class RenderConfig {
  /**
   * Configures a mesh with standard anti-bug settings.
   */
  static configureMesh(
    mesh: THREE.Object3D,
    layer: RenderLayer,
    options: { castShadow?: boolean; receiveShadow?: boolean; frustumCulled?: boolean } = {}
  ) {
    mesh.renderOrder = layer;
    mesh.castShadow = options.castShadow ?? false;
    mesh.receiveShadow = options.receiveShadow ?? false;
    mesh.frustumCulled = options.frustumCulled ?? false;
  }

  /**
   * Creates a transparent material suitable for 2D sprites (like Food).
   * Enforces no mipmapping, no depth writing, and disabled fog.
   */
  static createSpriteMaterial(texture: THREE.Texture): THREE.MeshBasicMaterial {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.1,
      fog: false,
    });
  }

  /**
   * Creates a standard opaque material (like Tombstones).
   * Enforces disabled fog to prevent gamma/lighting shifts.
   */
  static createOpaqueMaterial(color: number, roughness = 0.8, metalness = 0.1): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      fog: false,
    });
  }
}
