// ROLE: CPU-side fading trample trail: records recent snake head positions and exposes a fixed-size uniform buffer. No rendering, no game logic.

export const GRASS_TRAIL_LIFETIME_MS = 3200;
export const GRASS_TRAIL_INTERVAL_MS = 100;
export const GRASS_TRAIL_MAX_POINTS = 32;
const TELEPORT_DISTANCE = 160;
const MIN_STEP_DISTANCE = 3;

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

/** Ring of recent head positions, faded by age and reset on a map wrap/teleport. */
export class GrassTrail {
  private readonly points: TrailPoint[] = [];
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private lastPushAt = Number.NEGATIVE_INFINITY;

  public update(nowMs: number, x: number, y: number): void {
    if (!Number.isFinite(nowMs) || !Number.isFinite(x) || !Number.isFinite(y)) return;

    if (Number.isFinite(this.lastX) && Number.isFinite(this.lastY)) {
      const jump = Math.hypot(x - this.lastX, y - this.lastY);
      if (jump > TELEPORT_DISTANCE) this.reset();
    }
    this.lastX = x;
    this.lastY = y;

    while (this.points.length > 0 && nowMs - this.points[0].time > GRASS_TRAIL_LIFETIME_MS) {
      this.points.shift();
    }

    const last = this.points[this.points.length - 1];
    const moved = !last || Math.hypot(x - last.x, y - last.y) >= MIN_STEP_DISTANCE;
    if (moved && nowMs - this.lastPushAt >= GRASS_TRAIL_INTERVAL_MS) {
      this.points.push({ x, y, time: nowMs });
      this.lastPushAt = nowMs;
      if (this.points.length > GRASS_TRAIL_MAX_POINTS) this.points.shift();
    }
  }

  /** Writes vec4(x, y, fade, 0) per point and returns the active count. */
  public fill(nowMs: number, out: Float32Array): number {
    let count = 0;
    for (const point of this.points) {
      if (count >= GRASS_TRAIL_MAX_POINTS) break;
      const age = Math.max(0, nowMs - point.time);
      const t = Math.min(1, age / GRASS_TRAIL_LIFETIME_MS);
      const fade = 1 - t * t * (3 - 2 * t);
      if (fade <= 0.001) continue;
      const offset = count * 4;
      out[offset] = point.x;
      out[offset + 1] = point.y;
      out[offset + 2] = fade;
      out[offset + 3] = 0;
      count++;
    }
    return count;
  }

  public reset(): void {
    this.points.length = 0;
    this.lastX = Number.NaN;
    this.lastY = Number.NaN;
    this.lastPushAt = Number.NEGATIVE_INFINITY;
  }
}
