// @vitest-environment jsdom
// ROLE: Tests for the non-throwing localStorage wrapper.
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeStorage } from "./safeStorage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("safeStorage", () => {
  it("reads, writes and removes values", () => {
    expect(safeStorage.get("test-key")).toBeNull();
    expect(safeStorage.set("test-key", "value")).toBe(true);
    expect(safeStorage.get("test-key")).toBe("value");
    expect(safeStorage.remove("test-key")).toBe(true);
    expect(safeStorage.get("test-key")).toBeNull();
  });

  it("swallows storage method failures", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });

    expect(safeStorage.get("test-key")).toBeNull();
    expect(safeStorage.set("test-key", "value")).toBe(false);
    expect(safeStorage.remove("test-key")).toBe(false);
  });

  it("swallows a throwing localStorage getter", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(safeStorage.get("test-key")).toBeNull();
    expect(safeStorage.set("test-key", "value")).toBe(false);
    expect(safeStorage.remove("test-key")).toBe(false);
  });
});
