// ROLE: Процедурная генерация 3D-геометрии арбуза для FoodRenderer.

import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { finalizeFruitGeometry } from "./FruitGeometryUtils";

function applyColor(geometry: THREE.BufferGeometry, colorHex: number) {
  const color = new THREE.Color(colorHex);
  const colors = [];
  const count = geometry.attributes.position.count;
  for (let i = 0; i < count; i++) {
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

function applyRindColor(geometry: THREE.BufferGeometry) {
  const position = geometry.attributes.position;
  const base = new THREE.Color(0x1e5b2b);
  const stripe = new THREE.Color(0x3f8f38);
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const angle = Math.atan2(position.getZ(i), position.getX(i));
    const color = Math.sin(angle * 9) > 0.4 ? stripe : base;
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function prepareGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let geom = geometry.clone();
  if (geom.index) {
    geom = geom.toNonIndexed();
  }

  const attributes = geom.attributes;
  for (const key in attributes) {
    if (key !== "position" && key !== "normal" && key !== "color") {
      geom.deleteAttribute(key);
    }
  }
  return geom;
}

export function createWatermelonGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  // Арбуз (слегка вытянутая сфера)
  const bodyGeom = new THREE.SphereGeometry(0.8, 32, 16);
  bodyGeom.scale(1, 1.2, 1);
  applyRindColor(bodyGeom);
  geometries.push(prepareGeometry(bodyGeom));

  // Хвостик: base sits on the rind (top = 0.8 * 1.2).
  const stemGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
  stemGeom.translate(0, 1.11, 0);
  applyColor(stemGeom, 0x55aa55);
  geometries.push(prepareGeometry(stemGeom));

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  if (!merged) {
    throw new Error("Failed to merge watermelon geometries");
  }

  merged.rotateX(Math.PI / 2);

  return finalizeFruitGeometry(merged);
}
