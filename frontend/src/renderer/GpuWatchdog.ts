// ROLE: Pure watchdog that decides whether GPU time or frame time owns adaptive resolution.
// Tracks visibility transitions and stale GPU samples; no DOM, WebGL or rendering.

export const GPU_WATCHDOG_MS = 5000;

export class GpuWatchdog {
  private fallback = false;
  private lastSampleAt: number;
  private wasVisible: boolean;

  constructor(now: number, visible: boolean) {
    this.lastSampleAt = now;
    this.wasVisible = visible;
  }

  /** Call once per rendered frame. Returns true when the GPU sampler should own the ratio. */
  public shouldUseGpu(now: number, visible: boolean, supported: boolean): boolean {
    this.onVisibilityChange(visible, now);

    if (!supported) return false;

    if (!visible) {
      // Hidden frames are not a stall; keep the watchdog from expiring.
      this.lastSampleAt = now;
      return !this.fallback;
    }

    if (now - this.lastSampleAt > GPU_WATCHDOG_MS) this.fallback = true;
    return !this.fallback;
  }

  /** Call when a valid GPU result arrives (even if the frame-time sampler owned this frame). */
  public onSample(now: number): void {
    this.lastSampleAt = now;
    this.fallback = false;
  }

  /** Call from visibilitychange because rAF may stop before a hidden frame runs. */
  public onVisibilityChange(visible: boolean, now: number): void {
    if (visible === this.wasVisible) return;

    this.wasVisible = visible;
    this.lastSampleAt = now;
  }

  public reset(now: number, visible: boolean): void {
    this.fallback = false;
    this.lastSampleAt = now;
    this.wasVisible = visible;
  }

  public get fallbackActive(): boolean {
    return this.fallback;
  }
}
