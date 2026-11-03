// ROLE: Unit tests for the pure adaptive-resolution GPU watchdog.
import { describe, expect, it } from "vitest";
import { GPU_WATCHDOG_MS, GpuWatchdog } from "./GpuWatchdog";

describe("GpuWatchdog", () => {
  it("never owns the ratio or arms fallback when the GPU timer is unsupported", () => {
    const watchdog = new GpuWatchdog(0, true);

    expect(watchdog.shouldUseGpu(GPU_WATCHDOG_MS + 10_000, true, false)).toBe(false);
    expect(watchdog.fallbackActive).toBe(false);
  });

  it("falls back after 5 s without samples and recovers on a valid sample", () => {
    const watchdog = new GpuWatchdog(0, true);

    expect(watchdog.shouldUseGpu(GPU_WATCHDOG_MS, true, true)).toBe(true);
    expect(watchdog.shouldUseGpu(GPU_WATCHDOG_MS + 1, true, true)).toBe(false);
    expect(watchdog.fallbackActive).toBe(true);

    watchdog.onSample(GPU_WATCHDOG_MS + 20);
    expect(watchdog.fallbackActive).toBe(false);
    expect(watchdog.shouldUseGpu(GPU_WATCHDOG_MS + 20, true, true)).toBe(true);
  });

  it("measures the timeout from the latest sample, not from the first stall", () => {
    const watchdog = new GpuWatchdog(0, true);

    expect(watchdog.shouldUseGpu(4000, true, true)).toBe(true);
    watchdog.onSample(4000);

    // 4 s after the sample: still healthy.
    expect(watchdog.shouldUseGpu(8000, true, true)).toBe(true);

    // 6 s after the sample: fallback.
    expect(watchdog.shouldUseGpu(10_000, true, true)).toBe(false);
    expect(watchdog.fallbackActive).toBe(true);
  });

  it("does not count hidden time as a stall and rebaselines on return", () => {
    const watchdog = new GpuWatchdog(0, true);
    watchdog.onVisibilityChange(false, 1000);

    // Ten seconds pass while rAF is stopped; the first visible frame is healthy.
    expect(watchdog.shouldUseGpu(11_000, true, true)).toBe(true);
    expect(watchdog.fallbackActive).toBe(false);

    // The return itself restarted the timer.
    expect(watchdog.shouldUseGpu(15_000, true, true)).toBe(true);
    expect(watchdog.shouldUseGpu(16_001, true, true)).toBe(false);
  });

  it("reset clears fallback and restarts the timeout", () => {
    const watchdog = new GpuWatchdog(0, true);

    expect(watchdog.shouldUseGpu(6000, true, true)).toBe(false);
    expect(watchdog.fallbackActive).toBe(true);

    watchdog.reset(10_000, true);
    expect(watchdog.fallbackActive).toBe(false);

    expect(watchdog.shouldUseGpu(14_000, true, true)).toBe(true);
    expect(watchdog.shouldUseGpu(16_001, true, true)).toBe(false);
  });

  it("rebaselines on hidden frames so background time never arms fallback", () => {
    const watchdog = new GpuWatchdog(0, true);

    expect(watchdog.shouldUseGpu(6000, false, true)).toBe(true);
    expect(watchdog.fallbackActive).toBe(false);

    expect(watchdog.shouldUseGpu(12_000, false, true)).toBe(true);
    expect(watchdog.fallbackActive).toBe(false);
  });
});
