// ROLE: Визуализация порталов.
import * as THREE from "three";
import { portalDiskShader, portalRingShader } from "./shaders/portal.glsl";

export class PortalRenderer {
  private scene: THREE.Scene;
  private diskMaterial: THREE.ShaderMaterial;
  private ringMaterial: THREE.ShaderMaterial;

  private diskMesh: THREE.InstancedMesh;
  private ringMesh: THREE.InstancedMesh;
  private maxInstances = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Create Materials
    this.diskMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: portalDiskShader.vertexShader,
      fragmentShader: portalDiskShader.fragmentShader
    });

    this.ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: portalRingShader.vertexShader,
      fragmentShader: portalRingShader.fragmentShader
    });

    // 2. Create Instanced Meshes
    const geom = new THREE.CircleGeometry(1, 32);

    this.diskMesh = new THREE.InstancedMesh(geom, this.diskMaterial, this.maxInstances);
    this.diskMesh.frustumCulled = false;
    this.diskMesh.renderOrder = 3;
    this.scene.add(this.diskMesh);

    this.ringMesh = new THREE.InstancedMesh(geom, this.ringMaterial, this.maxInstances);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 4;
    this.scene.add(this.ringMesh);
  }

  public update(msg: any, timeSec: number): void {
    this.diskMaterial.uniforms.uTime.value = timeSec;
    this.ringMaterial.uniforms.uTime.value = timeSec;

    const count = msg.portalCount || 0;
    if (count > 0 && msg.portalDiskMatrices) {
      this.updatePortalBuffers(msg, count);
    } else {
      this.diskMesh.count = 0;
      this.ringMesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.diskMesh);
    this.scene.remove(this.ringMesh);
    this.diskMesh.geometry.dispose();
    this.diskMaterial.dispose();
    this.ringMaterial.dispose();
  }

  private updatePortalBuffers(msg: any, count: number): void {
    // Disk Mesh
    this.diskMesh.instanceMatrix.array.set(msg.portalDiskMatrices);
    this.diskMesh.instanceMatrix.needsUpdate = true;
    if (!this.diskMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.diskMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.diskMesh.instanceColor.array.set(msg.portalDiskColors);
    this.diskMesh.instanceColor.needsUpdate = true;
    this.diskMesh.count = count;

    // Ring Mesh
    this.ringMesh.instanceMatrix.array.set(msg.portalRingMatrices);
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (!this.ringMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.ringMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.ringMesh.instanceColor.array.set(msg.portalRingColors);
    this.ringMesh.instanceColor.needsUpdate = true;
    this.ringMesh.count = count;
  }
}
