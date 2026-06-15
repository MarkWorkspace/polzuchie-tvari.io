// ROLE: Отрисовка отладочной сетки и коллизий в режиме debug.
import * as THREE from "three";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from "../game/Config";

export class DebugRenderer {
  private scene: THREE.Scene;
  private gridMesh: THREE.LineSegments | null = null;
  private collisionMesh: THREE.LineSegments | null = null;
  private isGridCreated = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public update(msg: any, debugMode: boolean): void {
    if (!debugMode) {
      this.clear();
      return;
    }

    const state = msg?.gameState;
    if (!state) return;

    this.ensureGridCreated(state);
    this.updateCollisionLines(state, msg);
  }

  public destroy(): void {
    this.clear();
  }

  private clear(): void {
    if (this.gridMesh) {
      this.scene.remove(this.gridMesh);
      this.gridMesh.geometry.dispose();
      (this.gridMesh.material as THREE.Material).dispose();
      this.gridMesh = null;
      this.isGridCreated = false;
    }
    if (this.collisionMesh) {
      this.scene.remove(this.collisionMesh);
      this.collisionMesh.geometry.dispose();
      (this.collisionMesh.material as THREE.Material).dispose();
      this.collisionMesh = null;
    }
  }

  private ensureGridCreated(state: any): void {
    if (this.isGridCreated) return;

    const mapW = state.server_world?.width ?? WORLD_WIDTH;
    const mapH = state.server_world?.height ?? WORLD_HEIGHT;
    const points: number[] = [];
    const cellW = 10.0 * gridSize;
    const cellH = 10.0 * gridSize;

    for (let x = 0; x <= mapW * gridSize; x += cellW) {
      points.push(x, 0, -1.9, x, -mapH * gridSize, -1.9);
    }
    for (let y = 0; y <= mapH * gridSize; y += cellH) {
      points.push(0, -y, -1.9, mapW * gridSize, -y, -1.9);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x22c55e, opacity: 0.35, transparent: true });
    
    this.gridMesh = new THREE.LineSegments(geom, mat);
    this.gridMesh.renderOrder = 5;
    this.scene.add(this.gridMesh);
    this.isGridCreated = true;
  }

  private updateCollisionLines(state: any, msg: any): void {
    const vertices: number[] = [];
    const colors: number[] = [];
    const baseHeadRadius = state.server_snake?.base_head_radius ?? 0.2;
    const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? 0.0005;
    const startLength = state.server_snake?.start_length ?? 5;

    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.body || p.body.length === 0) continue;

      const isSelf = pid === msg.myId;
      const currentLength = p.body.length;
      const effectiveLengthGained = Math.max(0, currentLength - startLength);
      const radius = (baseHeadRadius + effectiveLengthGained * 10.0 * scoreThicknessScale) * gridSize;

      const foundNickname = msg.nicknames?.find((n: any) => n.id === pid);
      const hx = foundNickname ? foundNickname.x : (p.body[0].x * gridSize + gridSize / 2.0);
      const hy = foundNickname ? (foundNickname.y - (radius + 4.5)) : -(p.body[0].y * gridSize + gridSize / 2.0);

      this.addPlayerDebugGeometry(hx, hy, radius, p.angle, isSelf, vertices, colors);
    }

    this.renderCollisionLines(vertices, colors);
  }

  private addPlayerDebugGeometry(
    hx: number, hy: number, radius: number, angle: number,
    isSelf: boolean, vertices: number[], colors: number[]
  ): void {
    const zOffset = 3.0;
    const segments = 16;

    for (let j = 0; j < segments; j++) {
      const theta1 = (j / segments) * Math.PI * 2;
      const theta2 = ((j + 1) / segments) * Math.PI * 2;
      const x1 = hx + Math.cos(theta1) * radius;
      const y1 = hy + Math.sin(theta1) * radius;
      const x2 = hx + Math.cos(theta2) * radius;
      const y2 = hy + Math.sin(theta2) * radius;

      vertices.push(x1, y1, zOffset, x2, y2, zOffset);
      const r = isSelf ? 0.0 : 1.0;
      const g = isSelf ? 1.0 : 0.3;
      const b = isSelf ? 0.5 : 0.3;
      colors.push(r, g, b, r, g, b);
    }

    // Direction line
    const dirLength = radius * 2.0;
    const dx = hx + Math.cos(-angle) * dirLength;
    const dy = hy + Math.sin(-angle) * dirLength;
    vertices.push(hx, hy, zOffset, dx, dy, zOffset);
    colors.push(1.0, 0.0, 1.0, 1.0, 0.0, 1.0);
  }

  private renderCollisionLines(vertices: number[], colors: number[]): void {
    if (!this.collisionMesh) {
      const geom = new THREE.BufferGeometry();
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.8 });
      this.collisionMesh = new THREE.LineSegments(geom, mat);
      this.collisionMesh.renderOrder = 10;
      this.scene.add(this.collisionMesh);
    }

    const geom = this.collisionMesh.geometry;
    if (vertices.length > 0) {
      this.updateDynamicAttr(geom, "position", new Float32Array(vertices), 3);
      this.updateDynamicAttr(geom, "color", new Float32Array(colors), 3);
      geom.setDrawRange(0, vertices.length / 3);
      this.collisionMesh.visible = true;
    } else {
      this.collisionMesh.visible = false;
    }
  }

  private updateDynamicAttr(geom: THREE.BufferGeometry, name: string, data: Float32Array, itemSize: number): void {
    let attr = geom.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!attr || attr.array.length < data.length) {
      attr = new THREE.BufferAttribute(new Float32Array(Math.max(data.length * 1.3, 512)), itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute(name, attr);
    }
    attr.array.set(data);
    attr.needsUpdate = true;
  }
}
