// ROLE: Визуализация чёрных дыр.
import * as THREE from "three";
import {
  blackHoleCoreShader,
  blackHoleRingShader,
  blackHoleGravityShader
} from "./shaders/blackHole.glsl";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class BlackHoleRenderer {
  private scene: THREE.Scene;
  private coreMaterial: THREE.ShaderMaterial;
  private ringMaterial: THREE.ShaderMaterial;
  private gravityMaterial: THREE.ShaderMaterial;

  private coreMesh: THREE.InstancedMesh;
  private ringMesh: THREE.InstancedMesh;
  private gravityMesh: THREE.InstancedMesh;
  private maxInstances = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Create Materials
    this.coreMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: blackHoleCoreShader.vertexShader,
      fragmentShader: blackHoleCoreShader.fragmentShader
    });

    this.ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: blackHoleRingShader.vertexShader,
      fragmentShader: blackHoleRingShader.fragmentShader
    });

    this.gravityMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: blackHoleGravityShader.vertexShader,
      fragmentShader: blackHoleGravityShader.fragmentShader
    });

    // 2. Create Instanced Meshes
    const geom = new THREE.CircleGeometry(1, 32);

    this.gravityMesh = new THREE.InstancedMesh(geom, this.gravityMaterial, this.maxInstances);
    RenderConfig.configureMesh(this.gravityMesh, RenderLayer.GravityMesh);
    this.scene.add(this.gravityMesh);

    this.ringMesh = new THREE.InstancedMesh(geom, this.ringMaterial, this.maxInstances);
    RenderConfig.configureMesh(this.ringMesh, RenderLayer.BlackHoleRing);
    this.scene.add(this.ringMesh);

    this.coreMesh = new THREE.InstancedMesh(geom, this.coreMaterial, this.maxInstances);
    RenderConfig.configureMesh(this.coreMesh, RenderLayer.BlackHoleCore);
    this.scene.add(this.coreMesh);
  }

  public update(msg: any, timeSec: number): void {
    this.ringMaterial.uniforms.uTime.value = timeSec;
    this.gravityMaterial.uniforms.uTime.value = timeSec;

    const count = msg.blackHoleCount || 0;
    if (count > 0 && msg.blackHoleCoreMatrices) {
      this.updateBlackHoleBuffers(msg, count);
    } else {
      this.gravityMesh.count = 0;
      this.ringMesh.count = 0;
      this.coreMesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.gravityMesh);
    this.scene.remove(this.ringMesh);
    this.scene.remove(this.coreMesh);
    this.gravityMesh.geometry.dispose();
    this.gravityMaterial.dispose();
    this.ringMaterial.dispose();
    this.coreMaterial.dispose();
  }

  private updateBlackHoleBuffers(msg: any, count: number): void {
    this.gravityMesh.instanceMatrix.array.set(msg.blackHoleGravityMatrices);
    this.gravityMesh.instanceMatrix.needsUpdate = true;
    this.gravityMesh.count = count;

    this.ringMesh.instanceMatrix.array.set(msg.blackHoleRingMatrices);
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.count = count;

    this.coreMesh.instanceMatrix.array.set(msg.blackHoleCoreMatrices);
    this.coreMesh.instanceMatrix.needsUpdate = true;
    this.coreMesh.count = count;
  }
}
