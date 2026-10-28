// ROLE: Small pool of colored point lights for nearby snakes. No gameplay or serialization.
import * as THREE from "three";

const MAX_LIGHTS = 4;
const LIGHT_HEIGHT = 24;
const LIGHT_DISTANCE = 140;
const LIGHT_INTENSITY = 250;

interface SnakeLightSource {
  hx?: number;
  hy?: number;
  mx?: number;
  my?: number;
  tx?: number;
  ty?: number;
  glowColor?: number;
  isMe?: boolean;
}

interface LightCandidate {
  x: number;
  y: number;
  color: number;
  isMe: boolean;
}

export class SnakeLightPool {
  private readonly scene: THREE.Scene;
  private readonly lights: THREE.PointLight[] = [];
  private readonly candidates: LightCandidate[] = [];
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
        if (!Number.isFinite(player.hx) || !Number.isFinite(player.hy)) continue;
        const color = player.glowColor ?? 0xffa64d;
        const isMe = Boolean(player.isMe);

        // The local snake gets a mid + tail light pair so its whole body
        // colors the ground; other snakes get one body-centred light.
        if (isMe) {
          const midX = Number.isFinite(player.mx) ? player.mx! : player.hx!;
          const midY = Number.isFinite(player.my) ? player.my! : player.hy!;
          this.candidates.push({ x: midX, y: midY, color, isMe: true });
          if (Number.isFinite(player.tx) && Number.isFinite(player.ty)) {
            this.candidates.push({ x: player.tx!, y: player.ty!, color, isMe: true });
          }
        } else {
          const x = Number.isFinite(player.mx) ? player.mx! : player.hx!;
          const y = Number.isFinite(player.my) ? player.my! : player.hy!;
          this.candidates.push({ x, y, color, isMe: false });
        }
      }

      this.candidates.sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        const da = (a.x - camX) ** 2 + (a.y - camY) ** 2;
        const db = (b.x - camX) ** 2 + (b.y - camY) ** 2;
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
      light.position.set(source.x, source.y, LIGHT_HEIGHT);
      light.color.setHex(source.color);
      light.intensity = LIGHT_INTENSITY;
    }
  }

  public destroy(): void {
    for (const light of this.lights) {
      this.scene.remove(light);
    }
  }
}
