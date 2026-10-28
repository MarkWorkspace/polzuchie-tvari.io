// ROLE: Pure adaptive-resolution sampler. Turns frame times into a pixel ratio. No DOM or WebGL.

const TARGET_FPS = 57;
const LOW_FPS = 45;
const SAMPLE_WINDOW_MS = 1000;
const MIN_SAMPLES = 45;
// Hidden tabs are filtered in SceneManager; here we only ignore multi-second stalls.
const MAX_FRAME_GAP_MS = 2000;

export class AdaptiveResolution {
  private readonly minRatio: number;
  private readonly maxRatio: number;
  private ratio: number;
  private frameTimeMs = 0;
  private frameCount = 0;
  private elapsedMs = 0;

  constructor(minRatio: number, maxRatio: number, initialRatio: number) {
    this.minRatio = Math.max(0.1, minRatio);
    this.maxRatio = Math.max(this.minRatio, maxRatio);
    this.ratio = this.clamp(initialRatio);
  }

  public getRatio(): number {
    return this.ratio;
  }

  /** Feed one frame gap. Returns a new pixel ratio when the sample window should change it. */
  public sample(frameTimeMs: number): number | null {
    if (frameTimeMs <= 0 || frameTimeMs > MAX_FRAME_GAP_MS) return null;

    this.frameTimeMs += frameTimeMs;
    this.frameCount += 1;
    this.elapsedMs += frameTimeMs;

    if (this.frameCount < MIN_SAMPLES || this.elapsedMs < SAMPLE_WINDOW_MS) return null;

    const averageFrameTimeMs = this.frameTimeMs / this.frameCount;
    this.frameTimeMs = 0;
    this.frameCount = 0;
    this.elapsedMs = 0;

    const averageFps = 1000 / averageFrameTimeMs;
    let nextRatio = this.ratio;

    if (averageFps < LOW_FPS) {
      nextRatio = this.ratio - 0.1;
    } else if (averageFps > TARGET_FPS) {
      nextRatio = this.ratio + 0.1;
    }

    nextRatio = this.clamp(nextRatio);
    if (Math.abs(nextRatio - this.ratio) < 0.01) return null;

    this.ratio = nextRatio;
    return this.ratio;
  }

  private clamp(value: number): number {
    return Math.min(this.maxRatio, Math.max(this.minRatio, value));
  }
}
