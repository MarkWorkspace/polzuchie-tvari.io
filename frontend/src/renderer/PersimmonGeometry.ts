// ROLE: Процедурная генерация 3D-геометрии хурмы. Не содержит логики рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { finalizeFruitGeometry } from "./FruitGeometryUtils";

const PERSIMMON_COLOR = 0xff6600;
const LEAF_COLOR = 0x33aa33;

function colorize(geomIn: THREE.BufferGeometry, hexColor: number): THREE.BufferGeometry {
  let geom = geomIn;
  if (geom.index) {
    geom = geom.toNonIndexed();
  }
  const color = new THREE.Color(hexColor);
  const count = geom.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  for (const name in geom.attributes) {
    if (name !== "position" && name !== "normal" && name !== "color") {
      geom.deleteAttribute(name);
    }
  }
  return geom;
}

function createBody(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1, 16, 12);
  geom.scale(1, 0.85, 1); // Слегка приплюснутая форма
  return colorize(geom, PERSIMMON_COLOR);
}

function createCalyxLeaf(angle: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.3, 0.34, 0.62, 0);
  shape.quadraticCurveTo(0.3, -0.34, 0, 0);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geom.translate(0, 0, -0.0125);
  // Lay the leaf almost flat over the fruit shoulder, then fan it around.
  geom.rotateX(-Math.PI / 2.2);
  geom.rotateY(angle);
  geom.translate(0, 0.8, 0);
  return colorize(geom, LEAF_COLOR);
}

export function createPersimmonGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [createBody()];
  for (let i = 0; i < 4; i++) {
    geometries.push(createCalyxLeaf((i * Math.PI) / 2 + Math.PI / 4));
  }

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  merged.rotateX(Math.PI / 2);
  return finalizeFruitGeometry(merged);
}
