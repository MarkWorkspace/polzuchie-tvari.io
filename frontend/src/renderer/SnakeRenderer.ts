// ROLE: Меши змеек, сплайны, тени. Не физика, не HUD.
import * as THREE from "three";
import { patchSnakeMaterial } from "./shaders/snakeBody.glsl";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize, wrapOffsets } from "../game/Config";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class SnakeRenderer {
  private scene: THREE.Scene;
  private bodyMaterial!: THREE.MeshStandardMaterial;
  private eyeMaterial!: THREE.MeshBasicMaterial;
  private pupilMaterial!: THREE.MeshBasicMaterial;

  private bodyMesh!: THREE.InstancedMesh;
  private eyeMesh!: THREE.InstancedMesh;
  private pupilMesh!: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
    this.initMeshes();
  }

  public update(msg: any, _camera?: THREE.PerspectiveCamera, _width?: number, _height?: number): void {
    this.updateUniforms(msg);
    this.updateGeometries(msg);
    this.updateInstancedParts(msg);
  }

  public destroy(): void {
    [this.bodyMesh, this.eyeMesh, this.pupilMesh].forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    [this.bodyMaterial, this.eyeMaterial, this.pupilMaterial].forEach((mat) => mat.dispose());
  }

  private updateUniforms(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    [this.bodyMaterial].forEach((mat) => {
      if (mat.userData.uniforms) {
        mat.userData.uniforms.uTime.value = performance.now();
        mat.userData.uniforms.uMapWidth.value = mapW * gridSize;
        mat.userData.uniforms.uMapHeight.value = mapH * gridSize;
      }
    });
  }

  private updateGeometries(msg: any): void {
    const bodyGeom = this.bodyMesh.geometry;
    if (msg.bodyVertices.length > 0) {
      this.updateDynamicAttr(bodyGeom, "position", msg.bodyVertices, 3);
      this.updateDynamicAttr(bodyGeom, "uv", msg.bodyUVs, 2);
      this.updateDynamicAttr(bodyGeom, "customColor", msg.bodyColors, 3);
      this.updateDynamicAttr(bodyGeom, "snakeParams", msg.bodySnakeParams, 2);
      this.updateDynamicIndex(bodyGeom, msg.bodyIndices);
      bodyGeom.setDrawRange(0, msg.bodyIndices.length);
    } else {
      bodyGeom.setDrawRange(0, 0);
    }
  }

  private updateInstancedParts(msg: any): void {
    const count = msg.eyeCount || 0;
    if (count > 0 && msg.eyeMatrices) {
      this.eyeMesh.instanceMatrix.array.set(msg.eyeMatrices);
      this.eyeMesh.instanceMatrix.needsUpdate = true;
      if (!this.eyeMesh.instanceColor) {
        this.eyeMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
      }
      this.eyeMesh.instanceColor.array.set(msg.eyeColors);
      this.eyeMesh.instanceColor.needsUpdate = true;
      this.eyeMesh.count = count;

      this.pupilMesh.instanceMatrix.array.set(msg.pupilMatrices);
      this.pupilMesh.instanceMatrix.needsUpdate = true;
      if (!this.pupilMesh.instanceColor) {
        this.pupilMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
      }
      this.pupilMesh.instanceColor.array.set(msg.pupilColors);
      this.pupilMesh.instanceColor.needsUpdate = true;
      this.pupilMesh.count = msg.pupilCount || 0;
    } else {
      this.eyeMesh.count = 0;
      this.pupilMesh.count = 0;
    }
  }

  private initMaterials(): void {
    const uInit = {
      uTime: { value: 0.0 },
      uMapWidth: { value: WORLD_WIDTH * gridSize }, 
      uMapHeight: { value: WORLD_HEIGHT * gridSize }
    };

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide
    });
    this.bodyMaterial.userData.uniforms = uInit;
    this.bodyMaterial.onBeforeCompile = (shader) => {
      patchSnakeMaterial(shader, uInit);
    };

    this.eyeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  }

  private initMeshes(): void {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    this.bodyMesh = new THREE.InstancedMesh(geom, this.bodyMaterial, 9);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000000);
    geom.computeBoundingSphere = () => { /* no-op */ };
    RenderConfig.configureMesh(this.bodyMesh, RenderLayer.SnakeBody, { castShadow: true });
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.Matrix4().makeTranslation(wrapOffsets[i][0], wrapOffsets[i][1], 0);
      this.bodyMesh.setMatrixAt(i, mat);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.bodyMesh);

    const circleGeom = new THREE.CircleGeometry(1, 32);
    const pupilGeom = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    pupilGeom.rotateX(Math.PI / 2.0);

    this.eyeMesh = new THREE.InstancedMesh(circleGeom, this.eyeMaterial, 2000);
    RenderConfig.configureMesh(this.eyeMesh, RenderLayer.SnakeEyes);
    this.scene.add(this.eyeMesh);

    this.pupilMesh = new THREE.InstancedMesh(pupilGeom, this.pupilMaterial, 2000);
    RenderConfig.configureMesh(this.pupilMesh, RenderLayer.SnakePupils);
    this.scene.add(this.pupilMesh);
  }

  private updateDynamicAttr(geom: THREE.BufferGeometry, name: string, data: Float32Array, itemSize: number): void {
    let attr = geom.getAttribute(name) as THREE.BufferAttribute | undefined;
    const requiredLength = data.length;

    if (!attr || attr.array.length < requiredLength) {
      const size = Math.max(Math.ceil(requiredLength * 1.3), 500000);
      attr = new THREE.BufferAttribute(new Float32Array(size), itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute(name, attr);
    }
    attr.array.set(data);
    attr.needsUpdate = true;
  }

  private updateDynamicIndex(geom: THREE.BufferGeometry, indices: Uint32Array): void {
    let attr = geom.getIndex();
    const requiredLength = indices.length;

    if (!attr || attr.array.length < requiredLength) {
      const size = Math.max(Math.ceil(requiredLength * 1.3), 500000);
      attr = new THREE.BufferAttribute(new Uint32Array(size), 1);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setIndex(attr);
    }
    (attr.array as Uint32Array).set(indices);
    attr.needsUpdate = true;
  }
}
