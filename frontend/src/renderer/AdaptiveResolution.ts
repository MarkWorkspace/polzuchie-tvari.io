// ROLE: Pure adaptive-resolution sampler. Turns GPU time (preferred) or frame gaps (VSync-bound fallback) into a pixel ratio. No DOM or WebGL.

const TARGET_FPS = 57;
const LOW_FPS = 45;
const SAMPLE_WINDOW_MS = 1000;
const MIN_SAMPLES = 45;
// Hidden tabs are filtered in SceneManager; here we only ignore multi-second stalls.
const MAX_FRAME_GAP_MS = 2000;

// GPU time is independent of VSync and the monitor refresh rate: it measures
// how long the frame actually spends on the GPU. Below the target we have
// headroom to raise the pixel ratio; above the low mark we are not holding
// ~55 FPS, so the ratio goes down. Between the two marks we hold still.
const GPU_TARGET_MS = 14;
const GPU_LOW_MS = 18;
const GPU_MAX_SAMPLE_MS = 2000;
const RATIO_STEP = 0.1;
// One GPU sample arrives per completed query (roughly every other frame because
// only one query is in flight), so 45 samples cover about 1.5 s of wall time on
// a 60 FPS display regardless of how fast the GPU itself is.
const GPU_MIN_SAMPLES = 45;

export class AdaptiveResolution {
  private readonly minRatio: number;
  private readonly maxRatio: number;
  private ratio: number;
  private frameTimeMs = 0;
  private frameCount = 0;
  private elapsedMs = 0;
  // Separate accumulator: frame-gap samples must never bias the GPU window.
  private gpuTimeMs = 0;
  private gpuSampleCount = 0;

  constructor(minRatio: number, maxRatio: number, initialRatio: number) {
    this.minRatio = Math.max(0.1, minRatio);
    this.maxRatio = Math.max(this.minRatio, maxRatio);
    this.ratio = this.clamp(initialRatio);
  }

  public getRatio(): number {
    return this.ratio;
  }

  /**
   * Feed one frame gap. This is the fallback when the browser has no GPU timer:
   * frame gaps follow VSync, so they say little about GPU headroom on
   * high-refresh displays. Returns a new pixel ratio when the window should
   * change it.
   */
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
      nextRatio = this.ratio - RATIO_STEP;
    } else if (averageFps > TARGET_FPS) {
      nextRatio = this.ratio + RATIO_STEP;
    }

    return this.commitRatio(nextRatio);
  }

  /**
   * Feed one GPU-time sample in milliseconds (preferred source). Returns a new
   * pixel ratio when the window should change it, or null while holding.
   */
  public sampleGpu(gpuTimeMs: number): number | null {
    if (!Number.isFinite(gpuTimeMs) || gpuTimeMs <= 0 || gpuTimeMs > GPU_MAX_SAMPLE_MS) return null;

    this.gpuTimeMs += gpuTimeMs;
    this.gpuSampleCount += 1;

    if (this.gpuSampleCount < GPU_MIN_SAMPLES) return null;

    const averageGpuMs = this.gpuTimeMs / this.gpuSampleCount;
    this.gpuTimeMs = 0;
    this.gpuSampleCount = 0;

    let nextRatio = this.ratio;

    if (averageGpuMs > GPU_LOW_MS) {
      nextRatio = this.ratio - RATIO_STEP;
    } else if (averageGpuMs < GPU_TARGET_MS) {
      nextRatio = this.ratio + RATIO_STEP;
    }

    return this.commitRatio(nextRatio);
  }

  private commitRatio(nextRatio: number): number | null {
    nextRatio = this.clamp(nextRatio);
    if (Math.abs(nextRatio - this.ratio) < 0.01) return null;

    this.ratio = nextRatio;
    return this.ratio;
  }

  private clamp(value: number): number {
    return Math.min(this.maxRatio, Math.max(this.minRatio, value));
  }
}
