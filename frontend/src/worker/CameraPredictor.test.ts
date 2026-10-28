// ROLE: Unit tests for spectator-camera wrapping in the predictor.
import { describe, expect, it } from "vitest";
import type { GameState } from "../types/game";
import { CameraPredictor } from "./CameraPredictor";

function emptyState(mapWidth: number, mapHeight: number): GameState {
  return {
    server_world: { width: mapWidth, height: mapHeight },
    players: {},
  } as unknown as GameState;
}

describe("CameraPredictor spectator camera", () => {
  it("uses the spectator position for wrapping and returns it as the frame camera", () => {
    const predictor = new CameraPredictor();
    const result = predictor.predict(0, "spectator_id", {}, emptyState(100, 100), null, 0, 20, {
      x: 300,
      y: -400,
    });

    expect(result).toEqual({ camX: 300, camY: -400, camAngle: 0 });
    expect(predictor.localX).toBe((300 - 10) / 20);
    expect(predictor.localY).toBe((400 - 10) / 20);
  });

  it("falls back to the map center without a spectator position", () => {
    const predictor = new CameraPredictor();
    const result = predictor.predict(0, "spectator_id", {}, emptyState(80, 60), null, 0, 20);

    expect(result).toEqual({ camX: 800, camY: -600, camAngle: 0 });
    expect(predictor.localX).toBe((800 - 10) / 20);
    expect(predictor.localY).toBe((600 - 10) / 20);
  });
});
