// ROLE: Unit tests for debug geometry buffer sizing.
import { describe, expect, it } from "vitest";
import { attributeCapacity } from "./DebugRenderer";

describe("attributeCapacity", () => {
  it("keeps the buffer length divisible by the item size", () => {
    for (const length of [1, 17, 170, 341, 1024]) {
      const capacity = attributeCapacity(length, 3);
      expect(capacity % 3).toBe(0);
      expect(capacity).toBeGreaterThanOrEqual(length);
      expect(capacity).toBeGreaterThanOrEqual(512);
    }
  });
});
