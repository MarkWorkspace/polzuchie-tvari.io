// ROLE: Unit tests for personal best storage and comparison.
import { describe, expect, it } from "vitest";
import { loadPersonalBest, updatePersonalBest } from "./personalStats";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("snake-personal-best", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("personalStats", () => {
  it("stores the first run as a new record", () => {
    const storage = memoryStorage();
    const result = updatePersonalBest({ score: 42, length: 17, kills: 2 }, storage);

    expect(result.isNewRecord).toBe(true);
    expect(result.best).toEqual({ score: 42, length: 17, kills: 2 });
    expect(loadPersonalBest(storage)).toEqual({ score: 42, length: 17, kills: 2 });
  });

  it("keeps per-field maxima and only flags a higher score as a record", () => {
    const storage = memoryStorage(JSON.stringify({ score: 100, length: 5, kills: 1 }));
    const result = updatePersonalBest({ score: 90, length: 30, kills: 4 }, storage);

    expect(result.isNewRecord).toBe(false);
    expect(result.best).toEqual({ score: 100, length: 30, kills: 4 });
  });

  it("falls back to zeroes for invalid storage", () => {
    const storage = memoryStorage("not-json");
    expect(loadPersonalBest(storage)).toEqual({ score: 0, length: 0, kills: 0 });
  });
});
