// ROLE: Отрисовка надгробий мертвых игроков через Three.js
import * as THREE from "three";
import type { Tombstone } from "../types/game";
import { gridSize } from "../game/Config";

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
    this.tombstoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.1
    });

    this.mesh = new THREE.InstancedMesh(
      this.tombstoneGeometry,
      this.tombstoneMaterial,
      this.MAX_INSTANCES
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    // Move up so it sits on the ground
    this.mesh.position.z = 0.4 * gridSize;
    
    // We render them higher than ground but lower than snake body
    this.mesh.renderOrder = 1.0; 
    
    this.scene.add(this.mesh);
  }

  public update(frame: any): void {
    if (!this.mesh) return;

    const tombstones: Tombstone[] = frame.tombstones || [];
    
    if (tombstones.length === 0) {
      this.mesh.count = 0;
      return;
    }

    const count = Math.min(tombstones.length, this.MAX_INSTANCES);
    this.mesh.count = count;

    for (let i = 0; i < count; i++) {
      const tomb = tombstones[i];
      const tx = tomb.x * gridSize + gridSize / 2;
      const ty = -(tomb.y * gridSize + gridSize / 2);
      this.dummy.position.set(tx, ty, 0);
      
      // Slightly sink the tombstone into the ground over time? Or just static.
      // Let's do static.
      this.dummy.rotation.x = Math.PI / 2; // Stand upright
      // Add slight random rotation based on ID so they don't look perfectly aligned
      const hash = tomb.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
      this.dummy.rotation.y = (hash % 100) / 100.0 * 0.4 - 0.2; 
      
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    
    this.mesh.instanceMatrix.needsUpdate = true;
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
