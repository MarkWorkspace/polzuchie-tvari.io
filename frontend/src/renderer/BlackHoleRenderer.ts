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
  private coreMaterial!: THREE.ShaderMaterial;
  private ringMaterial!: THREE.ShaderMaterial;
  private gravityMaterial!: THREE.ShaderMaterial;

  private coreMesh!: THREE.InstancedMesh;
  private ringMesh!: THREE.InstancedMesh;
  private gravityMesh!: THREE.InstancedMesh;
  private maxInstances = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this._initMaterials();
    this._initMeshes();
  }

  private _initMaterials(): void {
    this.coreMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: blackHoleCoreShader.vertexShader, fragmentShader: blackHoleCoreShader.fragmentShader
    });
    this.ringMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0.0 } },
      vertexShader: blackHoleRingShader.vertexShader, fragmentShader: blackHoleRingShader.fragmentShader
    });
    this.gravityMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0.0 } },
      vertexShader: blackHoleGravityShader.vertexShader, fragmentShader: blackHoleGravityShader.fragmentShader
    });
  }

  private _initMeshes(): void {
    const geom = new THREE.CircleGeometry(1, 32);

    this.gravityMesh = new THREE.InstancedMesh(geom, this.gravityMaterial, this.maxInstances);
    this.gravityMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.gravityMesh, RenderLayer.GravityMesh);
    this.scene.add(this.gravityMesh);

    this.ringMesh = new THREE.InstancedMesh(geom, this.ringMaterial, this.maxInstances);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.ringMesh, RenderLayer.BlackHoleRing);
    this.scene.add(this.ringMesh);

    this.coreMesh = new THREE.InstancedMesh(geom, this.coreMaterial, this.maxInstances);
    this.coreMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
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
    this._updateMesh(this.gravityMesh, msg.blackHoleGravityMatrices, count);
    this._updateMesh(this.ringMesh, msg.blackHoleRingMatrices, count);
    this._updateMesh(this.coreMesh, msg.blackHoleCoreMatrices, count);
  }

  private _updateMesh(mesh: THREE.InstancedMesh, matrices: Float32Array, count: number): void {
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = count;
  }
}
