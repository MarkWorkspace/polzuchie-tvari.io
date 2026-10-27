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

  it("ignores long frame gaps such as a hidden tab", () => {
    const adaptive = new AdaptiveResolution(0.6, 2, 1);

    for (let frame = 0; frame < 100; frame += 1) {
      expect(adaptive.sample(300)).toBeNull();
    }
    expect(adaptive.getRatio()).toBe(1);
  });

  it("clamps the initial ratio into the configured bounds", () => {
    expect(new AdaptiveResolution(0.6, 1.5, 2).getRatio()).toBe(1.5);
    expect(new AdaptiveResolution(0.6, 1.5, 0.2).getRatio()).toBe(0.6);
  });
});
