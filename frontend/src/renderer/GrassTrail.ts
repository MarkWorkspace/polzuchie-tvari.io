// ROLE: CPU-side fading trample trail: records recent snake tail-tip positions and exposes a fixed-size uniform buffer. No rendering, no game logic.

/**
 * The trail is intentionally long-lived: the meadow should remember where the
 * tail passed for half a minute. Points are sampled sparsely and the shader
 * connects them as segments, so the length does not need one sample per frame.
 */
export const GRASS_TRAIL_LIFETIME_MS = 32000;
export const GRASS_TRAIL_INTERVAL_MS = 250;
export const GRASS_TRAIL_MAX_POINTS = 128;
const TELEPORT_DISTANCE = 160;
const MIN_STEP_DISTANCE = 3;

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

/**
 * Resolves the tail tip from the worker-built frame. Render frames carry
 * lightweight players without bodies, so `activePlayers` is the source of
 * truth; falling back to the head only happens on an early/truncated frame.
 */
export function resolveGrassTrailPoint(
  frame: any,
  headX: number,
  headY: number,
): { x: number; y: number } {
  if (!Array.isArray(frame?.activePlayers)) return { x: headX, y: headY };

  const me = frame.activePlayers.find(
    (player: any) => player?.isMe === true || player?.id === frame?.myId,
  );
  if (!me || !Number.isFinite(me.tailX) || !Number.isFinite(me.tailY)) {
    return { x: headX, y: headY };
  }
  return { x: me.tailX, y: me.tailY };
}

/** Ring of recent tail-tip positions, faded by age and reset on a map wrap/teleport. */
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
