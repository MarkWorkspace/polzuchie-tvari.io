// ROLE: Regression tests for the finite camera-target guard (empty frames must not produce a NaN pose).

import { describe, expect, it, vi } from "vitest";
import { GameCamera } from "./Camera";

function makeCamera() {
  return {
    fov: 50,
    position: { set: vi.fn() },
    rotation: { order: "XYZ", set: vi.fn() },
    rotateX: vi.fn(),
    updateProjectionMatrix: vi.fn(),
  };
}

describe("GameCamera finite target guard", () => {
  it.each([
    ["missing", {}],
    ["missing x", { camY: -4 }],
    ["missing y", { camX: 12 }],
    ["NaN x", { camX: Number.NaN, camY: -4 }],
    ["infinite y", { camX: 12, camY: Number.POSITIVE_INFINITY }],
  ])("keeps the last pose when the target is %s", (_label, msg) => {
    const camera = makeCamera();

    new GameCamera().update(camera as any, msg, 0.016, "me", false);

    expect(camera.position.set).not.toHaveBeenCalled();
    expect(camera.rotation.set).not.toHaveBeenCalled();
    expect(camera.rotateX).not.toHaveBeenCalled();
  });

  it("moves the camera for a finite camX/camY target", () => {
    const camera = makeCamera();
    const frame = {
      camX: 120,
      camY: -80,
      camAngle: 0.4,
      gameState: { players: {} },
    };

    new GameCamera().update(camera as any, frame, 0.016, "me", false);

    expect(camera.position.set).toHaveBeenCalledTimes(1);
    const [x, y, z] = camera.position.set.mock.calls[0];
    expect([x, y, z].every(Number.isFinite)).toBe(true);
    expect(camera.rotateX).toHaveBeenCalledTimes(1);
  });
});
