// ROLE: Unit tests for spectator route parsing.
import { describe, expect, it } from "vitest";
import { resolveSpectatorMode } from "./spectatorMode";

describe("resolveSpectatorMode", () => {
  it("keeps a plain spectator route player-facing", () => {
    expect(resolveSpectatorMode(new URLSearchParams("?spectator=true"))).toEqual({
      enabled: true,
      debug: false,
    });
  });

  it("enables debug mode only for the explicit debug variant", () => {
    expect(resolveSpectatorMode(new URLSearchParams("?spectator=debug")).debug).toBe(true);
    expect(resolveSpectatorMode(new URLSearchParams("?spectator=true&debug=true")).debug).toBe(
      true,
    );
    expect(resolveSpectatorMode(new URLSearchParams("?debug=true"))).toEqual({
      enabled: false,
      debug: false,
    });
  });
});
