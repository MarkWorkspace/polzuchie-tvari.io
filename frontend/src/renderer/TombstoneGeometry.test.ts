// ROLE: Unit tests for the procedural tombstone silhouette and orientation.
import { describe, expect, it } from "vitest";
import { gridSize } from "../game/Config";
import { createTombstoneGeometry } from "./TombstoneGeometry";

describe("createTombstoneGeometry", () => {
  it("creates an upright slab with a wider base", () => {
    const geometry = createTombstoneGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;

    expect(box).not.toBeNull();
    const height = box!.max.z - box!.min.z;
    const thickness = box!.max.y - box!.min.y;
    const width = box!.max.x - box!.min.x;

    expect(height).toBeGreaterThan(1.1 * gridSize);
    expect(thickness).toBeLessThan(0.5 * gridSize);
    expect(width).toBeGreaterThan(0.5 * gridSize);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(geometry.getAttribute("normal")).toBeDefined();

    geometry.dispose();
  });
});
