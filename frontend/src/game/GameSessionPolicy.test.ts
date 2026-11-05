// ROLE: Unit tests for session input and identity guards.
import { describe, expect, it } from "vitest";
import { canSendGameInput, isNewPlayerIdentity } from "./GameSessionPolicy";

describe("canSendGameInput", () => {
  it("allows input only for a connected healthy session", () => {
    expect(canSendGameInput(true, false, false)).toBe(true);
    expect(canSendGameInput(false, false, false)).toBe(false);
    expect(canSendGameInput(true, true, false)).toBe(false);
    expect(canSendGameInput(true, false, true)).toBe(false);
  });
});

describe("isNewPlayerIdentity", () => {
  it("ignores a repeated FULL for the same player", () => {
    expect(isNewPlayerIdentity("player-1", "player-1")).toBe(false);
  });

  it("accepts a new or restored identity", () => {
    expect(isNewPlayerIdentity("", "player-1")).toBe(true);
    expect(isNewPlayerIdentity("player-1", "player-2")).toBe(true);
  });
});
