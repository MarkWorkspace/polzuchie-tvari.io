// ROLE: Симуляция частиц хвоста.

import { writeMatrix, randomRange } from "./shared/MathUtils";
import { parseColor } from "./shared/ColorUtils";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  life: number;
}

export class ParticleComputer {
  private activeParticles: Particle[] = [];

  public clear() {
    this.activeParticles = [];
  }

  public spawnParticlesForBooster(
    tx: number,
    ty: number,
    angle: number,
    snakeRadius: number,
    colorStr: string,
    speedMult: number
  ) {
    if (speedMult <= 1.1) return;
    const baseColor = parseColor(colorStr);

    for (let j = 0; j < 3; j++) {
      const pAngle = angle + Math.PI + randomRange(-0.3, 0.3);
      const pSpeed = randomRange(1.0, 3.5);
      
      this.activeParticles.push({
        x: tx + randomRange(-1.0, 1.0) * snakeRadius,
        y: ty + randomRange(-1.0, 1.0) * snakeRadius,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        color: baseColor,
        size: (0.15 + Math.random() * 0.25) * snakeRadius,
        life: 0.6 + Math.random() * 0.6,
      });
    }
  }

  public update(dt: number) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const part = this.activeParticles[i];
      part.x += part.vx * dt * 60.0;
      part.y += part.vy * dt * 60.0;
      part.life -= dt;
      
      if (part.life <= 0) {
        if (i < this.activeParticles.length - 1) {
          this.activeParticles[i] = this.activeParticles[this.activeParticles.length - 1];
        }
        this.activeParticles.pop();
      }
    }
  }

  public buildBuffers(
    fogR: number,
    fogG: number,
    fogB: number,
    calcFogAmount: (wx: number, wy: number) => number
  ): {
    particleMatrices: Float32Array;
    particleColors: Float32Array;
    particleCount: number;
  } {
    const len = this.activeParticles.length;
    const matrices = new Float32Array(len * 16);
    const colors = new Float32Array(len * 3);

    for (let i = 0; i < len; i++) {
      const part = this.activeParticles[i];
      writeMatrix(matrices, i, part.x, part.y, 0.9, part.size);

      const pr = ((part.color >> 16) & 255) / 255;
      const pg = ((part.color >> 8) & 255) / 255;
      const pb = (part.color & 255) / 255;

      const fogAmt = calcFogAmount(part.x, part.y);
      const finalR = pr + (fogR - pr) * fogAmt;
      const finalG = pg + (fogG - pg) * fogAmt;
      const finalB = pb + (fogB - pb) * fogAmt;

      const cIdx = i * 3;
      colors[cIdx + 0] = finalR;
      colors[cIdx + 1] = finalG;
      colors[cIdx + 2] = finalB;
    }

    return {
      particleMatrices: matrices,
      particleColors: colors,
      particleCount: len,
    };
  }
}
