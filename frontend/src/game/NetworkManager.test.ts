// ROLE: Regression tests for spectator/player identity storage.
import { describe, expect, it } from "vitest";
import { getClientIdStorageKey } from "./NetworkManager";

describe("client identity storage", () => {
  it("persists only player ids", () => {
    expect(getClientIdStorageKey("player")).toBe("snake_client_id");
    expect(getClientIdStorageKey("spectator")).toBeNull();
  });
});
