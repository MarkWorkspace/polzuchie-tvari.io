// ROLE: Инстансированные меши еды. Поддержка цветового и текстурного рендеринга.
import * as THREE from "three";
import { foodShader } from "./shaders/food.glsl";
import { RenderConfig, RenderLayer } from "./RenderConfig";

const FRUIT_SVGS = [
  "cherry.svg", "strawberry.svg", "grape.svg", "mandarin.svg",
  "persimmon.svg", "apple.svg", "pear.svg", "peach.svg",
  "pineapple.svg", "melon.svg", "watermelon.svg",
];

export class FoodRenderer {
  private scene: THREE.Scene;
  private colorMaterial: THREE.ShaderMaterial;
  private colorMesh: THREE.InstancedMesh;
  private textureMeshes: THREE.InstancedMesh[] = [];
  private textureMaterials: THREE.MeshBasicMaterial[] = [];
  private textures: THREE.Texture[] = [];
  private maxInstances = 5000;
  private geom: THREE.CircleGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geom = this._createGeometry();
    this.colorMaterial = this._createColorMaterial();
    this.colorMesh = this._createMesh(this.colorMaterial);
    this._loadFruitTextures();
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
    for (const mesh of this.textureMeshes) {
      this.scene.remove(mesh);
    }
    for (const mat of this.textureMaterials) mat.dispose();
    for (const tex of this.textures) tex.dispose();
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

  private _createMesh(material: THREE.Material): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(this.geom, material, this.maxInstances);
    RenderConfig.configureMesh(mesh, RenderLayer.Food);
    this.scene.add(mesh);
    return mesh;
  }

  private _loadFruitTextures(): void {
    const loader = new THREE.TextureLoader();
    for (const svg of FRUIT_SVGS) {
      const tex = loader.load(`/${svg}`);
      this.textures.push(tex);

      const mat = RenderConfig.createSpriteMaterial(tex);
      this.textureMaterials.push(mat);
      this.textureMeshes.push(this._createMesh(mat));
    }
  }

  private _hideAll(): void {
    this.colorMesh.count = 0;
    for (const m of this.textureMeshes) m.count = 0;
  }

  private _splitAndUpdate(msg: any, count: number): void {
    const indices: Int32Array = msg.foodImageIndices;
    const counts = new Int32Array(FRUIT_SVGS.length + 1);
    for (let i = 0; i < count; i++) counts[indices[i]]++;

    this._fillMeshData(msg, count, indices, counts);
  }

  private _fillMeshData(
    msg: any, count: number, indices: Int32Array, counts: Int32Array
  ): void {
    const totalSlots = FRUIT_SVGS.length + 1;
    const offsets = new Int32Array(totalSlots);
    this._ensureInstanceColor(this.colorMesh);

    for (let i = 0; i < count; i++) {
      const idx = indices[i];
      const mesh = idx === 0 ? this.colorMesh : this.textureMeshes[idx - 1];
      const slot = offsets[idx]++;
      this._copyInstance(msg, i, mesh, slot);
    }

    this.colorMesh.count = counts[0];
    this._markDirty(this.colorMesh);
    for (let t = 0; t < FRUIT_SVGS.length; t++) {
      this.textureMeshes[t].count = counts[t + 1];
      this._markDirty(this.textureMeshes[t]);
    }
  }

  private _copyInstance(
    msg: any, srcIdx: number, mesh: THREE.InstancedMesh, dstIdx: number
  ): void {
    const srcM = srcIdx * 16, dstM = dstIdx * 16;
    const mArr = mesh.instanceMatrix.array as Float32Array;
    for (let j = 0; j < 16; j++) mArr[dstM + j] = msg.foodMatrices[srcM + j];

    if (mesh.instanceColor) {
      const srcC = srcIdx * 3, dstC = dstIdx * 3;
      const cArr = mesh.instanceColor.array as Float32Array;
      cArr[dstC] = msg.foodColors[srcC];
      cArr[dstC + 1] = msg.foodColors[srcC + 1];
      cArr[dstC + 2] = msg.foodColors[srcC + 2];
    }
  }

  private _ensureInstanceColor(mesh: THREE.InstancedMesh): void {
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances * 3), 3
      );
    }
  }

  private _markDirty(mesh: THREE.InstancedMesh): void {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
