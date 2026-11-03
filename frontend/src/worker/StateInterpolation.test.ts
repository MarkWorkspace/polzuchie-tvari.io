// ROLE: Unit tests for state interpolation queueing and adaptive 2–3 tick delay.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { StateInterpolator } from "./StateInterpolation";

function state(tickRate = 30): GameState {
  return {
    server_tick_rate: tickRate,
    server_world: { width: 100, height: 100 },
    players: {},
  } as unknown as GameState;
}

function pushStable(interpolator: StateInterpolator, count: number, tickMs = 1000 / 30): void {
  for (let i = 0; i < count; i += 1) {
    interpolator.pushState(state(), i * tickMs);
  }
}

describe("StateInterpolator", () => {
  it("uses two ticks of delay on a stable 30 Hz stream", () => {
    const interpolator = new StateInterpolator();
    pushStable(interpolator, 10);

    expect(interpolator.getTargetDelayTicks()).toBe(2);
    expect(interpolator.getTargetDelayMs(30)).toBeCloseTo(2000 / 30, 6);
  });

  it("raises the delay to three ticks under sustained jitter", () => {
    const interpolator = new StateInterpolator();
    const timestamps = [0, 33, 83, 99, 149, 165, 215, 231, 281, 297];
    for (const timestamp of timestamps) {
      interpolator.pushState(state(), timestamp);
    }

    expect(interpolator.getTargetDelayTicks()).toBe(3);
    expect(interpolator.getTargetDelayMs(30)).toBeCloseTo(100, 6);
  });

  it("returns to two ticks after the jitter settles", () => {
    const interpolator = new StateInterpolator();
    const jittery = [0, 33, 83, 99, 149, 165, 215, 231, 281, 297];
    for (const timestamp of jittery) {
      interpolator.pushState(state(), timestamp);
    }
    expect(interpolator.getTargetDelayTicks()).toBe(3);

    let timestamp = 297;
    for (let i = 0; i < 12; i += 1) {
      timestamp += 1000 / 30;
      interpolator.pushState(state(), timestamp);
    }

    expect(interpolator.getTargetDelayTicks()).toBe(2);
  });

  it("resets delay and queue on clear", () => {
    const interpolator = new StateInterpolator();
    const jittery = [0, 33, 83, 99, 149, 165, 215, 231, 281, 297];
    for (const timestamp of jittery) {
      interpolator.pushState(state(), timestamp);
    }
    expect(interpolator.getTargetDelayTicks()).toBe(3);

    interpolator.clear();

    expect(interpolator.getTargetDelayTicks()).toBe(2);
    expect(interpolator.interpolate(1 / 60, 30)).toBeNull();
  });

  it("returns the only queued state without inventing a second one", () => {
    const interpolator = new StateInterpolator();
    const only = state();
    interpolator.pushState(only, 0);

    const result = interpolator.interpolate(1 / 60, 30);

    expect(result).not.toBeNull();
    expect(result?.state).toBe(only);
    expect(result?.lastState).toBe(only);
    expect(result?.progress).toBe(1);
  });
});
