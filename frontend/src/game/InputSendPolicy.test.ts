// ROLE: Unit tests for the pure steering send policy (edge, zero snap, throttle).
import { describe, expect, it } from "vitest";
import { STEERING_SEND_INTERVAL_MS, shouldSendSteering } from "./InputSendPolicy";

describe("shouldSendSteering", () => {
  it("sends the first changed value immediately", () => {
    expect(shouldSendSteering(1, 0, 0.4, 0)).toBe(true);
  });

  it("does not send an unchanged value", () => {
    expect(shouldSendSteering(100, 10, 0.4, 0.4)).toBe(false);
    expect(shouldSendSteering(100, 10, 0.405, 0.4)).toBe(false);
  });

  it("throttles ordinary changes to the send interval", () => {
    const last = 1000;
    expect(shouldSendSteering(last + STEERING_SEND_INTERVAL_MS - 1, last, 0.5, 0.4)).toBe(false);
    expect(shouldSendSteering(last + STEERING_SEND_INTERVAL_MS, last, 0.5, 0.4)).toBe(true);
  });

  it("sends a zero snap without waiting for the interval", () => {
    expect(shouldSendSteering(1001, 1000, 0, 0.4)).toBe(true);
  });

  it("forces a snapshot even when the value did not change", () => {
    expect(shouldSendSteering(1001, 1000, 0.4, 0.4, true)).toBe(true);
  });
});
