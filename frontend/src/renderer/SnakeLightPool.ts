// ROLE: Small pool of colored point lights for nearby snakes. No gameplay or serialization.
import * as THREE from "three";

const MAX_LIGHTS = 4;
const LIGHT_HEIGHT = 24;
const LIGHT_DISTANCE = 140;
const LIGHT_INTENSITY = 250;

interface SnakeLightSource {
  hx?: number;
  hy?: number;
  glowColor?: number;
  isMe?: boolean;
}

export class SnakeLightPool {
  private readonly scene: THREE.Scene;
  private readonly lights: THREE.PointLight[] = [];
  private readonly candidates: SnakeLightSource[] = [];
  private activeCount = 0;

  constructor(scene: THREE.Scene, activeCount = 3) {
    this.scene = scene;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = new THREE.PointLight(0xffffff, 0, LIGHT_DISTANCE, 2);
      light.position.set(0, 0, LIGHT_HEIGHT);
      light.castShadow = false;
      this.scene.add(light);
      this.lights.push(light);
    }
    this.setCount(activeCount);
  }

  public setCount(count: number): void {
    this.activeCount = Math.max(0, Math.min(MAX_LIGHTS, Math.floor(count)));
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const active = i < this.activeCount;
      this.lights[i].visible = active;
      if (!active) this.lights[i].intensity = 0;
    }
  }

  public update(activePlayers: SnakeLightSource[] | undefined, camX: number, camY: number): void {
    this.candidates.length = 0;
    if (this.activeCount > 0 && activePlayers) {
      for (const player of activePlayers) {
        if (Number.isFinite(player.hx) && Number.isFinite(player.hy)) {
          this.candidates.push(player);
        }
      }
      this.candidates.sort((a, b) => {
        if (Boolean(a.isMe) !== Boolean(b.isMe)) return a.isMe ? -1 : 1;
        const da = (a.hx! - camX) ** 2 + (a.hy! - camY) ** 2;
        const db = (b.hx! - camX) ** 2 + (b.hy! - camY) ** 2;
        return da - db;
      });
    }

    for (let i = 0; i < MAX_LIGHTS; i++) {
      const light = this.lights[i];
      const source = i < this.activeCount ? this.candidates[i] : undefined;
      if (!source) {
        light.visible = false;
        light.intensity = 0;
        continue;
      }

      light.visible = true;
      light.position.set(source.hx!, source.hy!, LIGHT_HEIGHT);
      light.color.setHex(source.glowColor ?? 0xffa64d);
      light.intensity = LIGHT_INTENSITY;
    }
  }

  public destroy(): void {
    for (const light of this.lights) {
      this.scene.remove(light);
    }
  }
}
