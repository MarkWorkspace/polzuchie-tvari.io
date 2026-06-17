// ROLE: Отрисовка надгробий мертвых игроков через Three.js
import * as THREE from "three";
import type { Tombstone } from "../types/game";
import { gridSize } from "../game/Config";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class TombstoneRenderer {
  private mesh: THREE.InstancedMesh | null = null;
  private scene: THREE.Scene;
  private tombstoneGeometry: THREE.BufferGeometry | null = null;
  private tombstoneMaterial: THREE.MeshStandardMaterial | null = null;
  
  private MAX_INSTANCES = 50;
  private dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMesh();
  }

  private initMesh() {
    this.tombstoneGeometry = new THREE.DodecahedronGeometry(1.2 * gridSize, 0);
    // Gray stone with roughness
    this.tombstoneMaterial = RenderConfig.createOpaqueMaterial(0x888888, 0.8, 0.1);

    this.mesh = new THREE.InstancedMesh(
      this.tombstoneGeometry,
      this.tombstoneMaterial,
      this.MAX_INSTANCES
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.mesh, RenderLayer.Opaque);
    
    // Move up so it sits on the ground
    this.mesh.position.z = 0.4 * gridSize;
    
    this.scene.add(this.mesh);
  }

  public update(frame: any): void {
    if (!this.mesh) return;
    const tombstones: Tombstone[] = frame.tombstones || [];
    const count = Math.min(tombstones.length, this.MAX_INSTANCES);
    this.mesh.count = count;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      this._updateInstance(tombstones[i], i);
    }
    
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, count * 16);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private _updateInstance(tomb: Tombstone, i: number): void {
    if (!this.mesh) return;
    const tx = tomb.x * gridSize + gridSize / 2;
    const ty = -(tomb.y * gridSize + gridSize / 2);
    this.dummy.position.set(tx, ty, 0);
    this.dummy.rotation.x = Math.PI / 2;
    const hash = tomb.id.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
    this.dummy.rotation.y = (hash % 100) / 100.0 * 0.4 - 0.2; 
    this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  public destroy(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
      this.mesh = null;
    }
    if (this.tombstoneGeometry) this.tombstoneGeometry.dispose();
    if (this.tombstoneMaterial) this.tombstoneMaterial.dispose();
  }
}
