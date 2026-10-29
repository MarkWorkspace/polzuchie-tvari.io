// ROLE: Procedural low-poly decor props (stones, bones, mushrooms): flat-shaded, vertex-coloured
// geometry with several silhouettes baked as variants. No textures, no rendering, no gameplay.

import * as THREE from "three";
import { type DecorPropType, PROP_VARIANT_COUNTS } from "./DecorField";

type Vec3 = readonly [number, number, number];

const TAU = Math.PI * 2;

const STONE_DARK = new THREE.Color(0x5c5c5b);
const STONE_MID = new THREE.Color(0x707070);
const STONE_LIGHT = new THREE.Color(0x848381);

const BONE = new THREE.Color(0xc0b8a7);
const BONE_SHADE = new THREE.Color(0x989180);
const BONE_SOCKET = new THREE.Color(0x565248);

const MUSHROOM_CAP = new THREE.Color(0xa5765a);
const MUSHROOM_CAP_LIGHT = new THREE.Color(0xb68b6d);
const MUSHROOM_STEM = new THREE.Color(0xb3a894);

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

/** Accumulates flat-shaded triangles for every baked variant of one family. */
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

function box(
  baker: VariantBaker,
  center: Vec3,
  half: Vec3,
  color: THREE.Color,
  variant: number,
): void {
  const [cx, cy, cz] = center;
  const [hx, hy, hz] = half;
  const p = (sx: number, sy: number, sz: number): Vec3 => [
    cx + sx * hx,
    cy + sy * hy,
    cz + sz * hz,
  ];

  // Top and bottom.
  baker.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), color, variant);
  baker.quad(p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1), p(-1, -1, -1), color, variant);
  // Sides.
  baker.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), color, variant);
  baker.quad(p(1, 1, -1), p(1, 1, 1), p(1, -1, 1), p(1, -1, -1), color, variant);
  baker.quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), color, variant);
  baker.quad(p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1), p(-1, -1, -1), color, variant);
}

/** Ribbon of quads following a curve; used for the arched ribs of the bone variant. */
function ribbon(
  baker: VariantBaker,
  points: Vec3[],
  halfWidth: number,
  color: THREE.Color,
  variant: number,
): void {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0, z0] = points[i];
    const [x1, y1, z1] = points[i + 1];
    baker.quad(
      [x0 - halfWidth, y0, z0],
      [x1 - halfWidth, y1, z1],
      [x1 + halfWidth, y1, z1],
      [x0 + halfWidth, y0, z0],
      color,
      variant,
    );
  }
}

function createStoneGeometry(): THREE.BufferGeometry {
  const baker = new VariantBaker();
  const sideColors = [STONE_DARK, STONE_MID, STONE_LIGHT, STONE_MID];

  // Variant 0: chunky boulder, 30 tris.
  {
    const bottom = ring(6, 0.92, 0.84, -0.24, 0.3);
    const middle = ring(6, 1.0, 0.9, 0.12, 0.2, 0.03, 0.02);
    const top = ring(6, 0.52, 0.48, 0.42, 0.35, 0.08, -0.04);
    baker.band(bottom, middle, sideColors, 0);
    baker.band(middle, top, [STONE_MID, STONE_LIGHT], 0);
    baker.fan([0.1, -0.02, 0.47], top, STONE_LIGHT, 0);
  }

  // Variant 1: low slab, 24 tris.
  {
    const bottom = ring(8, 0.98, 0.82, -0.22, 0.1);
    const top = ring(8, 0.9, 0.74, 0.2, 0.4);
    baker.band(bottom, top, [STONE_MID, STONE_DARK, STONE_MID, STONE_LIGHT], 1);
    baker.fan([0, 0, 0.23], top, STONE_LIGHT, 1);
  }

  // Variant 2: twin outcrop, 27 tris.
  {
    const base = ring(6, 0.55, 0.5, -0.22, 0.15, 0.34, 0.16);
    baker.fan([0.42, 0.1, 0.46], base, STONE_MID, 2);
    const stub = ring(7, 0.62, 0.56, -0.25, 0.5, -0.32, -0.18);
    const stubTop = ring(7, 0.46, 0.4, 0.22, 0.2, -0.34, -0.2);
    baker.band(stub, stubTop, [STONE_DARK, STONE_MID], 2);
    baker.fan([-0.34, -0.2, 0.27], stubTop, STONE_LIGHT, 2);
  }

  return baker.build();
}

function createBoneGeometry(): THREE.BufferGeometry {
  const baker = new VariantBaker();
  box(baker, [0, 0, 0.1], [0.62, 0.07, 0.07], BONE_SHADE, 0);
  for (let rib = 0; rib < 3; rib++) {
    const ribX = -0.58 + rib * 0.4;
    const points: Vec3[] = [];
    for (let step = 0; step < 4; step++) {
      const t = step / 3;
      const bow = Math.sin(Math.PI * t);
      points.push([ribX + 0.16 * bow, -0.62 + 1.24 * t, 0.1 + 0.34 * bow]);
    }
    ribbon(baker, points, 0.055, BONE, 0);
  }

  // Variant 1: small skull, 36 tris. The two front wall segments are dark
  // sockets instead of separate floating quads, so they cannot z-fight.
  {
    const bottom = ring(8, 0.62, 0.55, 0, 0, 0, 0.12);
    const middle = ring(8, 0.54, 0.48, 0.34, 0, 0, 0.16);
    const wallColors: THREE.Color[] = [];
    for (let i = 0; i < 8; i++) {
      const midAngle = ((i + 0.5) / 8) * TAU;
      const facingFront = Math.abs(midAngle - Math.PI / 2) <= Math.PI / 4 + 1e-6;
      wallColors.push(facingFront ? BONE_SOCKET : i % 2 === 0 ? BONE : BONE_SHADE);
    }
    baker.band(bottom, middle, wallColors, 1);
    baker.fan([0, 0.18, 0.5], middle, BONE, 1);
    box(baker, [0, 0.62, 0.08], [0.24, 0.16, 0.1], BONE_SHADE, 1);
  }

  return baker.build();
}

function createMushroomGeometry(): THREE.BufferGeometry {
  const baker = new VariantBaker();

  // Variant 0: tall cap, 20 tris.
  {
    const stem = ring(6, 0.16, 0.16, -0.15, 0.2);
    const stemTop = ring(6, 0.13, 0.13, 0.5, 0.2);
    baker.band(stem, stemTop, [MUSHROOM_STEM], 0);
    const rim = ring(8, 0.75, 0.75, 0.42, 0.1);
    baker.fan([0, 0, 1.16], rim, MUSHROOM_CAP, 0);
  }

  // Variant 1: wide cap, 22 tris.
  {
    const stem = ring(6, 0.18, 0.18, -0.15, 0.4);
    const stemTop = ring(6, 0.15, 0.15, 0.3, 0.4);
    baker.band(stem, stemTop, [MUSHROOM_STEM], 1);
    const rim = ring(10, 1.0, 1.0, 0.26, 0.25);
    baker.fan([0, 0, 0.94], rim, MUSHROOM_CAP_LIGHT, 1);
  }

  return baker.build();
}

const FACTORIES: Record<DecorPropType, () => THREE.BufferGeometry> = {
  stone: createStoneGeometry,
  bone: createBoneGeometry,
  mushroom: createMushroomGeometry,
};

/** Geometry with `PROP_VARIANT_COUNTS[type]` baked silhouettes and an `aVariant` attribute. */
export function createPropGeometry(type: DecorPropType): THREE.BufferGeometry {
  const geometry = FACTORIES[type]();
  geometry.name = `decor-${type}`;
  geometry.userData.variantCount = PROP_VARIANT_COUNTS[type];
  return geometry;
}
