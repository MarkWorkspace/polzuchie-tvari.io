// ROLE: Ground plane mesh with the procedural grass/grid shader. Owns the mesh,
// geometry, material and per-map transform; does not create lights or a renderer.
import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { RenderConfig, RenderLayer } from "./RenderConfig";
import type { QualityPreset } from "./RenderQuality";
import { patchGroundMaterial } from "./shaders/ground.glsl";

export const GROUND_Z = -2;

export function groundTransform(
  mapW: number,
  mapH: number,
): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
} {
  return {
    x: (mapW * gridSize) / 2,
    y: -(mapH * gridSize) / 2,
    scaleX: mapW / WORLD_WIDTH,
    scaleY: mapH / WORLD_HEIGHT,
  };
}

interface GroundUniforms {
  uGroundColor: { value: THREE.Color };
  uGridColor: { value: THREE.Color };
  uGridSize: { value: number };
  uWorldSize: { value: THREE.Vector2 };
}

export class GroundPlane {
  private readonly scene: THREE.Scene;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly uniforms: GroundUniforms;

  constructor(scene: THREE.Scene, preset: QualityPreset) {
    this.scene = scene;

    const uniforms: GroundUniforms = {
      uGroundColor: { value: new THREE.Color(0x5f7044) },
      uGridColor: { value: new THREE.Color(0x4f6039) },
      uGridSize: { value: gridSize },
      uWorldSize: { value: new THREE.Vector2(WORLD_WIDTH * gridSize, WORLD_HEIGHT * gridSize) },
    };
    this.uniforms = uniforms;

    this.material = new THREE.MeshStandardMaterial({
      color: 0x5f7044,
      roughness: 1.0,
      metalness: 0.0,
    });
    this.material.userData.uniforms = uniforms;
    this.material.onBeforeCompile = (shader) => patchGroundMaterial(shader, uniforms);

    const sizeX = WORLD_WIDTH * gridSize * 4;
    const sizeY = WORLD_HEIGHT * gridSize * 4;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY);
    this.mesh = new THREE.Mesh(geom, this.material);
    RenderConfig.configureMesh(this.mesh, RenderLayer.Ground);

    const transform = groundTransform(WORLD_WIDTH, WORLD_HEIGHT);
    this.mesh.position.set(transform.x, transform.y, GROUND_Z);
    this.mesh.scale.set(transform.scaleX, transform.scaleY, 1.0);
    this.mesh.receiveShadow = preset.shadows;
    this.scene.add(this.mesh);
  }

  public setReceiveShadow(enabled: boolean): void {
    this.mesh.receiveShadow = enabled;
  }

  public update(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;
    this.uniforms.uWorldSize.value.set(mapW * gridSize, mapH * gridSize);

    // The geometry is a 4x apron, so a plain map-size scale gives both player
    // and spectator the same generous ground coverage near map edges.
    this.mesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, GROUND_Z);
    this.mesh.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
