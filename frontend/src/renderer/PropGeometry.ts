// ROLE: Procedural low-poly decor stones: flat-shaded, vertex-coloured geometry
// with three silhouettes baked as variants. No textures, no rendering, no gameplay.

import * as THREE from "three";

type Vec3 = readonly [number, number, number];

const TAU = Math.PI * 2;

const STONE_DARK = new THREE.Color(0x5c5c5b);
const STONE_MID = new THREE.Color(0x707070);
const STONE_LIGHT = new THREE.Color(0x848381);

function ring(
  segments: number,
  radiusX: number,
  radiusY: number,
  z: number,
  phase = 0,
  centerX = 0,
  centerY = 0,
): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = phase + (i / segments) * TAU;
    points.push([centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY, z]);
  }
  return points;
}

/** Accumulates flat-shaded triangles for every baked silhouette. */
class VariantBaker {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly variants: number[] = [];

  public triangle(a: Vec3, b: Vec3, c: Vec3, color: THREE.Color, variant: number): void {
    this.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.colors.push(color.r, color.g, color.b);
    this.variants.push(variant, variant, variant);
  }

  public quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: THREE.Color, variant: number): void {
    this.triangle(a, b, c, color, variant);
    this.triangle(a, c, d, color, variant);
  }

  /** Wall between two matching closed rings; `colors` cycles per column. */
  public band(lower: Vec3[], upper: Vec3[], colors: THREE.Color[], variant: number): void {
    for (let i = 0; i < lower.length; i++) {
      const next = (i + 1) % lower.length;
      this.quad(lower[i], lower[next], upper[next], upper[i], colors[i % colors.length], variant);
    }
  }

  /** Flat cap fan from a ring to a centre point. */
  public fan(center: Vec3, outline: Vec3[], color: THREE.Color, variant: number): void {
    for (let i = 0; i < outline.length; i++) {
      const next = (i + 1) % outline.length;
      this.triangle(center, outline[i], outline[next], color, variant);
    }
  }

  public build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute("aVariant", new THREE.Float32BufferAttribute(this.variants, 1));
    geometry.computeVertexNormals();
    // Vertices of inactive variants collapse to a point at draw time, so the
    // real bounds are meaningless; the mesh is always drawn instead.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geometry.computeBoundingSphere = () => {
      /* manual culling: never recompute per frame */
    };
    return geometry;
  }
}

/**
 * Three embedded stone silhouettes (30, 24 and 27 triangles). Each is authored
 * around radius 1 with its base around z = -0.4, so placing it on the ground
 * leaves roughly half the rock below the surface.
 */
export function createStoneGeometry(): THREE.BufferGeometry {
  const baker = new VariantBaker();
  const sideColors = [STONE_DARK, STONE_MID, STONE_LIGHT, STONE_MID];

  // Variant 0: chunky embedded boulder, 30 tris.
  {
    const bottom = ring(6, 0.92, 0.84, -0.4, 0.3);
    const middle = ring(6, 1.0, 0.9, 0.06, 0.2, 0.03, 0.02);
    const top = ring(6, 0.52, 0.48, 0.36, 0.35, 0.08, -0.04);
    baker.band(bottom, middle, sideColors, 0);
    baker.band(middle, top, [STONE_MID, STONE_LIGHT], 0);
    baker.fan([0.1, -0.02, 0.41], top, STONE_LIGHT, 0);
  }

  // Variant 1: low embedded slab, 24 tris.
  {
    const bottom = ring(8, 0.98, 0.82, -0.4, 0.1);
    const top = ring(8, 0.9, 0.74, 0.3, 0.4);
    baker.band(bottom, top, [STONE_MID, STONE_DARK, STONE_MID, STONE_LIGHT], 1);
    baker.fan([0, 0, 0.34], top, STONE_LIGHT, 1);
  }

  // Variant 2: twin embedded outcrop, 27 tris.
  {
    const base = ring(6, 0.55, 0.5, -0.4, 0.15, 0.34, 0.16);
    baker.fan([0.42, 0.1, 0.38], base, STONE_MID, 2);
    const stub = ring(7, 0.62, 0.56, -0.4, 0.5, -0.32, -0.18);
    const stubTop = ring(7, 0.46, 0.4, 0.28, 0.2, -0.34, -0.2);
    baker.band(stub, stubTop, [STONE_DARK, STONE_MID], 2);
    baker.fan([-0.34, -0.2, 0.32], stubTop, STONE_LIGHT, 2);
  }

  const geometry = baker.build();
  geometry.name = "decor-stone";
  geometry.userData.variantCount = 3;
  return geometry;
}
