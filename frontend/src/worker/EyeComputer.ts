// ROLE: Позиции глаз и зрачков змеек.

import { writeMatrix } from "./shared/MathUtils";

export class EyeComputer {
  public eyeEx = new Float32Array(2000);
  public eyeEy = new Float32Array(2000);
  public eyeEz = new Float32Array(2000);
  public eyeR = new Float32Array(2000);
  public eyeColor = new Float32Array(2000);
  public eyeCount = 0;

  public pupilPx = new Float32Array(2000);
  public pupilPy = new Float32Array(2000);
  public pupilPz = new Float32Array(2000);
  public pupilR = new Float32Array(2000);
  public pupilColor = new Float32Array(2000);
  public pupilCount = 0;

  public reset() {
    this.eyeCount = 0;
    this.pupilCount = 0;
  }

  public addEyes(
    hx: number,
    hy: number,
    snakeRadius: number,
    snakeZ: number,
    angle: number,
    fogAmt: number
  ) {
    const eyeRadius = snakeRadius * 0.35;
    const pupilRadius = eyeRadius * 0.5;
    const forwardOffset = snakeRadius * 0.45;
    const sideOffset = snakeRadius * 0.45;
    const zOffset = snakeZ + 0.1;

    const visAngle = -angle;
    const dirFx = Math.cos(visAngle);
    const dirFy = Math.sin(visAngle);
    const dirRx = Math.cos(visAngle + Math.PI / 2);
    const dirRy = Math.sin(visAngle + Math.PI / 2);

    for (const side of [-1, 1]) {
      const ex = hx + dirFx * forwardOffset + dirRx * sideOffset * side;
      const ey = hy + dirFy * forwardOffset + dirRy * sideOffset * side;
      
      if (this.eyeCount < 1000) {
        this.eyeEx[this.eyeCount] = ex;
        this.eyeEy[this.eyeCount] = ey;
        this.eyeEz[this.eyeCount] = zOffset;
        this.eyeR[this.eyeCount] = eyeRadius;
        this.eyeColor[this.eyeCount] = fogAmt;
        this.eyeCount++;
      }

      const px = ex + dirFx * (eyeRadius * 0.3);
      const py = ey + dirFy * (eyeRadius * 0.3);
      
      if (this.pupilCount < 1000) {
        this.pupilPx[this.pupilCount] = px;
        this.pupilPy[this.pupilCount] = py;
        this.pupilPz[this.pupilCount] = zOffset + 0.01;
        this.pupilR[this.pupilCount] = pupilRadius;
        this.pupilColor[this.pupilCount] = fogAmt;
        this.pupilCount++;
      }
    }
  }

  public buildBuffers(fogR: number, fogG: number, fogB: number): {
    eyeMatrices: Float32Array;
    eyeColors: Float32Array;
    pupilMatrices: Float32Array;
    pupilColors: Float32Array;
  } {
    const eyeMatrices = new Float32Array(this.eyeCount * 16);
    const eyeColors = new Float32Array(this.eyeCount * 3);
    for (let i = 0; i < this.eyeCount; i++) {
      writeMatrix(eyeMatrices, i, this.eyeEx[i], this.eyeEy[i], this.eyeEz[i], this.eyeR[i]);
      const fogAmt = this.eyeColor[i];
      const cIdx = i * 3;
      eyeColors[cIdx + 0] = 1.0 + (fogR - 1.0) * fogAmt;
      eyeColors[cIdx + 1] = 1.0 + (fogG - 1.0) * fogAmt;
      eyeColors[cIdx + 2] = 1.0 + (fogB - 1.0) * fogAmt;
    }

    const pupilMatrices = new Float32Array(this.pupilCount * 16);
    const pupilColors = new Float32Array(this.pupilCount * 3);
    for (let i = 0; i < this.pupilCount; i++) {
      writeMatrix(pupilMatrices, i, this.pupilPx[i], this.pupilPy[i], this.pupilPz[i], this.pupilR[i]);
      const fogAmt = this.pupilColor[i];
      const cIdx = i * 3;
      pupilColors[cIdx + 0] = 0.0 + (fogR - 0.0) * fogAmt;
      pupilColors[cIdx + 1] = 0.0 + (fogG - 0.0) * fogAmt;
      pupilColors[cIdx + 2] = 0.0 + (fogB - 0.0) * fogAmt;
    }

    return { eyeMatrices, eyeColors, pupilMatrices, pupilColors };
  }
}
