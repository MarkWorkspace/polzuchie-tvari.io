// ROLE: Система частиц (свечение хвоста).
import * as THREE from "three";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class ParticleRenderer {
  private scene: THREE.Scene;
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.InstancedMesh;
  private maxInstances = 2000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create Basic Instanced Particle Material
    this.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      vertexColors: true,
      transparent: true,
      depthWrite: false
    });

    const geom = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(geom, this.material, this.maxInstances);
    RenderConfig.configureMesh(this.mesh, RenderLayer.Particle);
    this.scene.add(this.mesh);
  }

  public update(msg: any): void {
    const count = msg.particleCount || 0;
    if (count > 0 && msg.particleMatrices) {
      this.updateParticleBuffers(msg, count);
    } else {
      this.mesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private updateParticleBuffers(msg: any, count: number): void {
    this.mesh.instanceMatrix.array.set(msg.particleMatrices);
    this.mesh.instanceMatrix.needsUpdate = true;

    if (!this.mesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.mesh.instanceColor.array.set(msg.particleColors);
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = count;
  }
}
