// ROLE: Инстансированные меши еды. Поддержка процедурных 3D-моделей.
import * as THREE from "three";
import { foodShader } from "./shaders/food.glsl";
import { RenderConfig, RenderLayer } from "./RenderConfig";

import { createCherryGeometry } from "./CherryGeometry";
import { createStrawberryGeometry } from "./StrawberryGeometry";
import { createGrapeGeometry } from "./GrapeGeometry";
import { createMandarinGeometry } from "./MandarinGeometry";
import { createPersimmonGeometry } from "./PersimmonGeometry";
import { createAppleGeometry } from "./AppleGeometry";
import { createPearGeometry } from "./PearGeometry";
import { createPeachGeometry } from "./PeachGeometry";
import { createPineappleGeometry } from "./PineappleGeometry";
import { createMelonGeometry } from "./MelonGeometry";
import { createWatermelonGeometry } from "./WatermelonGeometry";

export class FoodRenderer {
  private scene: THREE.Scene;
  private colorMaterial: THREE.ShaderMaterial;
  private colorMesh: THREE.InstancedMesh;
  
  private fruitMeshes: THREE.InstancedMesh[] = [];
  private fruitMaterials: THREE.MeshStandardMaterial[] = [];
  
  private maxInstances = 5000;
  private geom: THREE.CircleGeometry;
  private totalFruitTypes = 11;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geom = this._createGeometry();
    this.colorMaterial = this._createColorMaterial();
    this.colorMesh = this._createMesh(this.colorMaterial, this.geom);
    
    const factories = [
      createCherryGeometry,
      createStrawberryGeometry,
      createGrapeGeometry,
      createMandarinGeometry,
      createPersimmonGeometry,
      createAppleGeometry,
      createPearGeometry,
      createPeachGeometry,
      createPineappleGeometry,
      createMelonGeometry,
      createWatermelonGeometry,
    ];

    for (const factory of factories) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 });
      
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           #ifdef USE_COLOR
             totalEmissiveRadiance += vColor.rgb * 1.5;
           #endif
           #ifdef USE_INSTANCING_COLOR
             totalEmissiveRadiance += vInstancingColor.rgb * 1.5;
           #endif
          `
        );
      };

      this.fruitMaterials.push(mat);
      this.fruitMeshes.push(this._createMesh(mat, factory()));
    }
  }

  public update(msg: any): void {
    const count = msg.foodCount || 0;
    if (count > 0 && msg.foodMatrices && msg.foodImageIndices) {
      this._splitAndUpdate(msg, count);
    } else {
      this._hideAll();
    }
  }

  public destroy(): void {
    this.scene.remove(this.colorMesh);
    this.colorMesh.geometry.dispose();
    this.colorMaterial.dispose();
    
    for (const mesh of this.fruitMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mat of this.fruitMaterials) {
      mat.dispose();
    }
  }

  private _createGeometry(): THREE.CircleGeometry {
    const geom = new THREE.CircleGeometry(1.0, 16);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
    geom.computeBoundingSphere = () => { /* no-op */ };
    return geom;
  }

  private _createColorMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: foodShader.vertexShader,
      fragmentShader: foodShader.fragmentShader,
    });
  }

  private _createMesh(material: THREE.Material, geometry: THREE.BufferGeometry): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(mesh, RenderLayer.Food, { castShadow: true, receiveShadow: true });
    this.scene.add(mesh);
    return mesh;
  }

  private _hideAll(): void {
    this.colorMesh.count = 0;
    for (const m of this.fruitMeshes) m.count = 0;
  }

  private _splitAndUpdate(msg: any, count: number): void {
    const indices: Int32Array = msg.foodImageIndices;
    const counts = new Int32Array(this.totalFruitTypes + 1);
    for (let i = 0; i < count; i++) {
      let idx = indices[i];
      if (idx > this.totalFruitTypes) idx = 0; // Fallback for out of bounds
      counts[idx]++;
    }

    this._fillMeshData(msg, count, indices, counts);
  }

  private _fillMeshData(
    msg: any, count: number, indices: Int32Array, counts: Int32Array
  ): void {
    const offsets = new Int32Array(this.totalFruitTypes + 1);
    this._ensureInstanceColor(this.colorMesh);

    for (let i = 0; i < count; i++) {
      let idx = indices[i];
      if (idx > this.totalFruitTypes) idx = 0;
      
      const mesh = idx === 0 ? this.colorMesh : this.fruitMeshes[idx - 1];
      const slot = offsets[idx]++;
      this._copyInstance(msg, i, mesh, slot, idx === 0);
    }

    this.colorMesh.count = counts[0];
    this._markDirty(this.colorMesh, counts[0], true);
    
    for (let t = 0; t < this.totalFruitTypes; t++) {
      const mesh = this.fruitMeshes[t];
      mesh.count = counts[t + 1];
      this._markDirty(mesh, counts[t + 1], false);
    }
  }

  private _copyInstance(
    msg: any, srcIdx: number, mesh: THREE.InstancedMesh, dstIdx: number, copyColor: boolean
  ): void {
    const srcM = srcIdx * 16, dstM = dstIdx * 16;
    const mArr = mesh.instanceMatrix.array as Float32Array;
    for (let j = 0; j < 16; j++) mArr[dstM + j] = msg.foodMatrices[srcM + j];

    if (copyColor && mesh.instanceColor) {
      const srcC = srcIdx * 3, dstC = dstIdx * 3;
      const cArr = mesh.instanceColor.array as Float32Array;
      cArr[dstC] = msg.foodColors[srcC];
      cArr[dstC + 1] = msg.foodColors[srcC + 1];
      cArr[dstC + 2] = msg.foodColors[srcC + 2];
    }
  }

  private _ensureInstanceColor(mesh: THREE.InstancedMesh): void {
    if (!mesh.instanceColor) {
      const attr = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances * 3), 3
      );
      attr.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = attr;
    }
  }

  private _markDirty(mesh: THREE.InstancedMesh, count: number, hasColor: boolean): void {
    if (count === 0) return;
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (hasColor && mesh.instanceColor) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, count * 3);
      mesh.instanceColor.needsUpdate = true;
    }
  }
}
