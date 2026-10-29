// ROLE: Shared post-processing for procedural fruit geometry. Drops degenerate triangles and normalizes every fruit to a unit bounding sphere at the origin. Does not build shapes or render.
import * as THREE from "three";

const DEGENERATE_AREA_SQ = 1e-12;

const a = new THREE.Vector3();
const b = new THREE.Vector3();
const c = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();
const cross = new THREE.Vector3();

function triangleAreaSq(
  position: THREE.BufferAttribute,
  i0: number,
  i1: number,
  i2: number,
): number {
  a.fromBufferAttribute(position, i0);
  b.fromBufferAttribute(position, i1);
  c.fromBufferAttribute(position, i2);
  ab.copy(b).sub(a);
  ac.copy(c).sub(a);
  cross.crossVectors(ab, ac);
  return cross.lengthSq();
}

/**
 * Removes zero-area triangles (for example the duplicate rings at the poles
 * of CapsuleGeometry). Returns the input unchanged when nothing is degenerate.
 */
function removeDegenerateTriangles(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  // Fruit factories only emit flat BufferAttributes, never interleaved ones.
  const position = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!position) return geometry;

  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const kept: number[] = [];
  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const i0 = index ? index.getX(triangle * 3) : triangle * 3;
    const i1 = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const i2 = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
    if (triangleAreaSq(position, i0, i1, i2) > DEGENERATE_AREA_SQ) {
      kept.push(i0, i1, i2);
    }
  }

  if (kept.length === triangleCount * 3) return geometry;

  const cleaned = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const source = geometry.attributes[name] as THREE.BufferAttribute;
    const itemSize = source.itemSize;
    const values = new Float32Array(kept.length * itemSize);
    for (let i = 0; i < kept.length; i++) {
      const sourceOffset = kept[i] * itemSize;
      const targetOffset = i * itemSize;
      for (let component = 0; component < itemSize; component++) {
        values[targetOffset + component] = source.array[sourceOffset + component];
      }
    }
    cleaned.setAttribute(name, new THREE.BufferAttribute(values, itemSize, source.normalized));
  }

  geometry.dispose();
  return cleaned;
}

/**
 * Enforces the FoodComputer invariant: fruit geometry is centered at the
 * origin and its bounding sphere has the requested radius (1.0 by default),
 * so the instance scale matches the gameplay collision radius.
 */
export function finalizeFruitGeometry(
  geometry: THREE.BufferGeometry,
  targetRadius = 1,
): THREE.BufferGeometry {
  const cleaned = removeDegenerateTriangles(geometry);
  cleaned.computeBoundingSphere();
  const sphere = cleaned.boundingSphere;
  if (!sphere || !(sphere.radius > 0) || !Number.isFinite(sphere.radius)) {
    return cleaned;
  }

  cleaned.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
  const scale = targetRadius / sphere.radius;
  cleaned.scale(scale, scale, scale);
  cleaned.computeBoundingSphere();
  return cleaned;
}
