// ROLE: Regression tests for lightweight player data on the minimap.
import { describe, expect, it } from "vitest";
import { getPlayerDotColor, getPlayerHead } from "./Minimap";

describe("Minimap player helpers", () => {
  it("reads the lightweight head_x/head_y payload", () => {
    expect(getPlayerHead({ head_x: 12.5, head_y: 7.25, body_len: 9 })).toEqual({
      x: 12.5,
      y: 7.25,
    });
  });

  it("still accepts the legacy flat body payload", () => {
    expect(getPlayerHead({ body: [3, 4, 5, 6] })).toEqual({ x: 3, y: 4 });
  });

  it("returns null for a missing body", () => {
    expect(getPlayerHead({})).toBeNull();
    expect(getPlayerHead(null)).toBeNull();
  });

  it("never passes a pattern skin name to the canvas fillStyle", () => {
    expect(getPlayerDotColor("rainbow")).toBe("#22c55e");
    expect(getPlayerDotColor("#ef4444")).toBe("#ef4444");
    expect(getPlayerDotColor("zebra")).toBe("#e2e8f0");
  });
});
