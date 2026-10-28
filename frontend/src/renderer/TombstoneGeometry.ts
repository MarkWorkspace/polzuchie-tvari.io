// ROLE: Procedural upright tombstone geometry (arched slab with a wider base). No rendering.
import * as THREE from "three";
import { gridSize } from "../game/Config";

export function createTombstoneGeometry(): THREE.ExtrudeGeometry {
  const width = 0.62 * gridSize;
  const height = 1.25 * gridSize;
  const thickness = 0.36 * gridSize;
  const baseHeight = 0.12 * gridSize;
  const baseWidth = width + 0.12 * gridSize;
  const half = width / 2;
  const baseHalf = baseWidth / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-baseHalf, 0);
  shape.lineTo(baseHalf, 0);
  shape.lineTo(baseHalf, baseHeight);
  shape.lineTo(half, baseHeight);
  shape.lineTo(half, height - half);
  shape.absarc(0, height - half, half, 0, Math.PI, false);
  shape.lineTo(-half, baseHeight);
  shape.lineTo(-baseHalf, baseHeight);
  shape.lineTo(-baseHalf, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.025 * gridSize,
    bevelSize: 0.02 * gridSize,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // The silhouette is authored in XY; stand it up along Z with the base at z=0.
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}
