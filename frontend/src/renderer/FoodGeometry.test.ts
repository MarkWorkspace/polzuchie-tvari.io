// ROLE: Regression tests for the procedural fruit invariants required by FoodComputer's instancing. No WebGL.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createAppleGeometry } from "./AppleGeometry";
import { createCherryGeometry } from "./CherryGeometry";
import { createGrapeGeometry } from "./GrapeGeometry";
import { createMandarinGeometry } from "./MandarinGeometry";
import { createMelonGeometry } from "./MelonGeometry";
import { createPeachGeometry } from "./PeachGeometry";
import { createPearGeometry } from "./PearGeometry";
import { createPersimmonGeometry } from "./PersimmonGeometry";
import { createPineappleGeometry } from "./PineappleGeometry";
import { createStrawberryGeometry } from "./StrawberryGeometry";
import { createWatermelonGeometry } from "./WatermelonGeometry";

const MAX_TRIANGLES = 1200;
const MIN_RADIUS = 0.95;
const MAX_RADIUS = 1.05;
const MAX_CENTER_OFFSET = 0.05;
const MIN_Z = -1.05;

interface FruitFactory {
  name: string;
  create: () => THREE.BufferGeometry;
}

const factories: FruitFactory[] = [
  { name: "Cherry", create: createCherryGeometry },
  { name: "Strawberry", create: createStrawberryGeometry },
  { name: "Grape", create: createGrapeGeometry },
  { name: "Mandarin", create: createMandarinGeometry },
  { name: "Persimmon", create: createPersimmonGeometry },
  { name: "Apple", create: createAppleGeometry },
  { name: "Pear", create: createPearGeometry },
  { name: "Peach", create: createPeachGeometry },
  { name: "Pineapple", create: createPineappleGeometry },
  { name: "Melon", create: createMelonGeometry },
  { name: "Watermelon", create: createWatermelonGeometry },
];

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();
const cross = new THREE.Vector3();
const normal = new THREE.Vector3();

function geometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute("position");
  return (geometry.index?.count ?? position.count) / 3;
}

describe.each(factories)("$name fruit geometry", ({ create }) => {
  it("is finite, centered, unit-sized, non-degenerate and within budget", () => {
    const geometry = create();
    const position = geometry.getAttribute("position");
    const normalAttribute = geometry.getAttribute("normal");

    expect(position).toBeDefined();
    expect(normalAttribute).toBeDefined();

    let finite = true;
    let minZ = Infinity;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        finite = false;
      }
      minZ = Math.min(minZ, z);

      normal.fromBufferAttribute(normalAttribute, i);
      if (
        !Number.isFinite(normal.x) ||
        !Number.isFinite(normal.y) ||
        !Number.isFinite(normal.z) ||
        normal.lengthSq() < 1e-12
      ) {
        finite = false;
      }
    }

    expect(finite).toBe(true);
    expect(minZ).toBeGreaterThan(MIN_Z);
    expect(geometryTriangleCount(geometry)).toBeLessThanOrEqual(MAX_TRIANGLES);

    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    expect(sphere).not.toBeNull();
    expect(sphere!.radius).toBeGreaterThanOrEqual(MIN_RADIUS);
    expect(sphere!.radius).toBeLessThanOrEqual(MAX_RADIUS);
    expect(sphere!.center.length()).toBeLessThan(MAX_CENTER_OFFSET);

    const index = geometry.index;
    let degenerate = 0;
    for (let triangle = 0; triangle < geometryTriangleCount(geometry); triangle++) {
      const i0 = index ? index.getX(triangle * 3) : triangle * 3;
      const i1 = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const i2 = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
      a.fromBufferAttribute(position, i0);
      b.fromBufferAttribute(position, i1);
      c.fromBufferAttribute(position, i2);
      ab.copy(b).sub(a);
      ac.copy(c).sub(a);
      cross.crossVectors(ab, ac);
      if (cross.lengthSq() < 1e-12) degenerate++;
    }
    expect(degenerate).toBe(0);

    geometry.dispose();
  });
});
