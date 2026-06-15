// ROLE: Инстансированные меши еды.
import * as THREE from "three";
import { foodShader } from "./shaders/food.glsl";
export class FoodRenderer {
  private scene: THREE.Scene;
  private foodMaterial: THREE.ShaderMaterial;
  
  private foodMesh: THREE.InstancedMesh;
  private maxInstances = 5000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Create Materials
    this.foodMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: foodShader.vertexShader,
      fragmentShader: foodShader.fragmentShader
    });

    // 2. Create Instanced Meshes
    // Use CircleGeometry so real castShadows have a round shape, instead of square PlaneGeometry.
    const geom = new THREE.CircleGeometry(1.0, 16);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000000);
    geom.computeBoundingSphere = () => { /* no-op */ };
    
    this.foodMesh = new THREE.InstancedMesh(geom, this.foodMaterial, this.maxInstances);
    this.foodMesh.frustumCulled = false;
    this.foodMesh.renderOrder = 1;
    this.foodMesh.castShadow = true;
    this.scene.add(this.foodMesh);
  }

  public update(msg: any): void {
    const count = msg.foodCount || 0;
    if (count > 0 && msg.foodMatrices) {
      this.updateFoodBuffers(msg, count);
    } else {
      this.foodMesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.foodMesh);
    this.foodMesh.geometry.dispose();
    this.foodMaterial.dispose();
  }

  private updateFoodBuffers(msg: any, count: number): void {
    // Update Food Mesh matrices & colors
    this.foodMesh.instanceMatrix.array.set(msg.foodMatrices);
    this.foodMesh.instanceMatrix.needsUpdate = true;

    if (!this.foodMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.foodMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.foodMesh.instanceColor.array.set(msg.foodColors);
    this.foodMesh.instanceColor.needsUpdate = true;
    this.foodMesh.count = count;
  }
}
