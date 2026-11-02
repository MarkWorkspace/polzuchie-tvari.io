// ROLE: Unit tests for SnakeRenderer dynamic-buffer upload ranges. Checks that
// only the written prefix of the growable body/index buffers is flagged for
// upload. Does not cover materials, shaders or instanced eyes/glow rendering.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SnakeRenderer } from "./SnakeRenderer";

interface BodyFrame {
  bodyVertices: Float32Array;
  bodyUVs: Float32Array;
  bodyColors: Float32Array;
  bodySnakeParams: Float32Array;
  bodyIndices: Uint32Array;
}

function frame(vertexCount: number, indexCount: number): BodyFrame {
  const bodyVertices = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    bodyVertices[i * 3] = i * 10;
    bodyVertices[i * 3 + 1] = i * 5;
  }
  return {
    bodyVertices,
    bodyUVs: new Float32Array(vertexCount * 2),
    bodyColors: new Float32Array(vertexCount * 3).fill(1),
    bodySnakeParams: new Float32Array(vertexCount * 2),
    bodyIndices: new Uint32Array(indexCount),
  };
}

function bodyGeometry(scene: THREE.Scene): THREE.BufferGeometry {
  const mesh = scene.children.find(
    (child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh &&
      child.geometry.getAttribute("snakeParams") !== undefined,
  );
  if (!mesh) throw new Error("snake body mesh not found");
  return mesh.geometry;
}

function dynamicAttribute(geom: THREE.BufferGeometry, name: string): THREE.BufferAttribute {
  const attr = geom.getAttribute(name) as THREE.BufferAttribute | undefined;
  if (!attr) throw new Error(`missing attribute ${name}`);
  return attr;
}

describe("SnakeRenderer dynamic upload ranges", () => {
  it("uploads only the used prefix of the growable position buffer", () => {
    const scene = new THREE.Scene();
    const renderer = new SnakeRenderer(scene);
    const msg = frame(3, 3);

    renderer.update(msg);
    const geom = bodyGeometry(scene);
    const position = dynamicAttribute(geom, "position");

    // Update ranges are measured in array components, which is why the count
    // is the payload length rather than vertex count.
    expect(position.updateRanges).toEqual([{ start: 0, count: msg.bodyVertices.length }]);
    // The allocation stays growable (>= 500k floats), so the range must be far
    // smaller than the buffer it lives in.
    expect(position.array.length).toBeGreaterThan(msg.bodyVertices.length);
    expect(position.updateRanges[0].count).toBeLessThan(position.array.length);

    const sideAttributes = [
      ["uv", msg.bodyUVs],
      ["customColor", msg.bodyColors],
      ["snakeParams", msg.bodySnakeParams],
    ] as const;
    for (const [name, data] of sideAttributes) {
      const attr = dynamicAttribute(geom, name);
      expect(attr.updateRanges).toHaveLength(1);
      expect(attr.updateRanges[0].start).toBe(0);
      expect(attr.updateRanges[0].count).toBe(data.length);
      expect(attr.updateRanges[0].count).toBeLessThan(attr.array.length);
    }

    renderer.destroy();
  });

  it("uploads only the used prefix of the growable index buffer", () => {
    const scene = new THREE.Scene();
    const renderer = new SnakeRenderer(scene);
    const msg = frame(4, 6);

    renderer.update(msg);
    const geom = bodyGeometry(scene);
    const index = geom.getIndex();
    expect(index).not.toBeNull();
    const indexAttr = index as THREE.BufferAttribute;

    expect(indexAttr.updateRanges).toEqual([{ start: 0, count: msg.bodyIndices.length }]);
    expect(indexAttr.array.length).toBeGreaterThan(msg.bodyIndices.length);
    expect(indexAttr.updateRanges[0].count).toBeLessThan(indexAttr.array.length);
    expect(geom.drawRange).toEqual({ start: 0, count: msg.bodyIndices.length });

    renderer.destroy();
  });

  it("replaces the previous frame's range instead of accumulating it", () => {
    const scene = new THREE.Scene();
    const renderer = new SnakeRenderer(scene);

    renderer.update(frame(3, 3));
    const geom = bodyGeometry(scene);
    const position = dynamicAttribute(geom, "position");
    const firstLength = position.array.length;

    const next = frame(5, 9);
    renderer.update(next);
    const nextIndex = geom.getIndex() as THREE.BufferAttribute;

    expect(position.updateRanges).toEqual([{ start: 0, count: next.bodyVertices.length }]);
    expect(nextIndex.updateRanges).toEqual([{ start: 0, count: next.bodyIndices.length }]);
    // Small frames reuse the existing allocation.
    expect(position.array.length).toBe(firstLength);
    expect(geom.drawRange).toEqual({ start: 0, count: next.bodyIndices.length });

    renderer.destroy();
  });
});
