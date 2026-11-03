// ROLE: Unit tests for the pure adaptive-resolution sampler.
import { describe, expect, it } from "vitest";
import { AdaptiveResolution } from "./AdaptiveResolution";

function runWindow(adaptive: AdaptiveResolution, frameTimeMs: number, frames = 80): number | null {
  let ratio: number | null = null;
  for (let frame = 0; frame < frames; frame += 1) {
    const next = adaptive.sample(frameTimeMs);
    if (next !== null) ratio = next;
  }
  return ratio;
}

function runGpuWindow(adaptive: AdaptiveResolution, gpuTimeMs: number, frames = 80): number | null {
  let ratio: number | null = null;
  for (let frame = 0; frame < frames; frame += 1) {
    const next = adaptive.sampleGpu(gpuTimeMs);
    if (next !== null) ratio = next;
  }
  return ratio;
}

describe("AdaptiveResolution", () => {
  it("lowers the ratio when the sampled frame rate is below 45 FPS", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    expect(runWindow(adaptive, 1000 / 50)).toBeNull();
    expect(adaptive.getRatio()).toBe(1);

    expect(runWindow(adaptive, 25)).toBe(0.9);
    expect(adaptive.getRatio()).toBe(0.9);
  });

  it("raises the ratio while there is frame headroom and clamps at the cap", () => {
    const adaptive = new AdaptiveResolution(0.6, 1.5, 1);

    expect(runWindow(adaptive, 14)).toBe(1.1);

    for (let window = 0; window < 10; window += 1) {
      runWindow(adaptive, 14);
    }
    expect(adaptive.getRatio()).toBe(1.5);
  });

  it("never drops below the minimum ratio", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 0.6);

    for (let window = 0; window < 10; window += 1) {
      expect(runWindow(adaptive, 40)).toBeNull();
    }
    expect(adaptive.getRatio()).toBe(0.6);
  });

  it("lowers the ratio for very slow frames instead of ignoring them", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    expect(runWindow(adaptive, 400, 10)).toBeNull();
    expect(runWindow(adaptive, 400, 45)).toBe(0.9);
    expect(adaptive.getRatio()).toBe(0.9);
  });

  it("ignores multi-second stalls", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    for (let frame = 0; frame < 100; frame += 1) {
      expect(adaptive.sample(3000)).toBeNull();
    }
    expect(adaptive.getRatio()).toBe(1);
  });

  it("clamps the initial ratio into the configured bounds", () => {
    expect(new AdaptiveResolution(0.6, 1.5, 2).getRatio()).toBe(1.5);
    expect(new AdaptiveResolution(0.6, 1.5, 0.2).getRatio()).toBe(0.6);
  });

  it("lowers the ratio once 45 GPU samples exceed the low mark", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    expect(runGpuWindow(adaptive, 20, 44)).toBeNull();
    expect(adaptive.getRatio()).toBe(1);

    expect(runGpuWindow(adaptive, 20, 1)).toBe(0.9);
    expect(adaptive.getRatio()).toBe(0.9);
  });

  it("never drops below the minimum ratio on sustained GPU pressure", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 0.6);

    expect(runGpuWindow(adaptive, 20, 45)).toBeNull();
    expect(adaptive.getRatio()).toBe(0.6);
  });

  it("raises the ratio on GPU headroom and clamps at the cap", () => {
    const adaptive = new AdaptiveResolution(0.6, 1.5, 1);

    expect(runGpuWindow(adaptive, 10, 45)).toBe(1.1);

    for (let window = 0; window < 10; window += 1) {
      runGpuWindow(adaptive, 10, 45);
    }
    expect(adaptive.getRatio()).toBe(1.5);
  });

  it("holds the ratio between the GPU target and low marks, including exact bounds", () => {
    for (const gpuMs of [14, 16, 18]) {
      const adaptive = new AdaptiveResolution(0.6, 2, 1);

      for (let window = 0; window < 5; window += 1) {
        expect(runGpuWindow(adaptive, gpuMs, 45)).toBeNull();
      }
      expect(adaptive.getRatio()).toBe(1);
    }
  });

  it("ignores invalid and multi-second GPU samples", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    for (let frame = 0; frame < 200; frame += 1) {
      expect(adaptive.sampleGpu(0)).toBeNull();
      expect(adaptive.sampleGpu(-5)).toBeNull();
      expect(adaptive.sampleGpu(3000)).toBeNull();
      expect(adaptive.sampleGpu(Number.NaN)).toBeNull();
      expect(adaptive.sampleGpu(Number.POSITIVE_INFINITY)).toBeNull();
    }
    expect(adaptive.getRatio()).toBe(1);
  });

  it("keeps the GPU and frame-time accumulators separate", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    // Neither sampler reaches its 45-sample window here, and frame gaps must
    // not count as GPU samples.
    for (let frame = 0; frame < 44; frame += 1) {
      expect(adaptive.sample(25)).toBeNull();
    }
    expect(runGpuWindow(adaptive, 20, 44)).toBeNull();
    expect(adaptive.getRatio()).toBe(1);

    // The 45th GPU sample is the first one allowed to move the ratio.
    expect(runGpuWindow(adaptive, 20, 1)).toBe(0.9);
  });
});
