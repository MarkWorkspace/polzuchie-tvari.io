// ROLE: Unit tests for worker color parsing and skin glow tints.
import { describe, expect, it } from "vitest";
import { parseColor, resolveSkinGlowColor } from "./ColorUtils";

describe("ColorUtils", () => {
  it("parses hex colors and falls back for empty input", () => {
    expect(parseColor("#ef4444")).toBe(0xef4444);
    expect(parseColor("")).toBe(0x22c55e);
  });

  it("gives patterned skins a readable glow tint", () => {
    expect(resolveSkinGlowColor("zebra")).toBe(0xf4f7ff);
    expect(resolveSkinGlowColor("tiger")).toBe(0xff9d3c);
    expect(resolveSkinGlowColor("cyberpunk")).toBe(0xff45e8);
    expect(resolveSkinGlowColor("rainbow")).toBe(0x8af4ff);
    expect(resolveSkinGlowColor("#3b82f6")).toBe(0x3b82f6);
  });
});
