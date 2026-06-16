// ROLE: Процедурная генерация 3D-геометрии мандарина. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const MANDARIN_COLOR = 0xff8c00;
const LEAF_COLOR = 0x2a9d8f;

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
    if (name !== 'position' && name !== 'normal' && name !== 'color') {
      geom.deleteAttribute(name);
    }
  }
  return geom;
}

function createFruit(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(0.5, 32, 16);
  // Слегка приплюснутая по оси Y сфера
  geom.scale(1, 0.8, 1);
  return colorize(geom, MANDARIN_COLOR);
}

function createLeaf(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.2, 0.2, 0.4, 0.0);
  shape.quadraticCurveTo(0.2, -0.2, 0, 0);
  
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  geom.translate(0, 0, -0.01);
  geom.rotateY(Math.PI / 6);
  geom.rotateZ(Math.PI / 4);
  geom.translate(0, 0.38, 0);
  return colorize(geom, LEAF_COLOR);
}

function createStem(): THREE.BufferGeometry {
  const geom = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8);
  geom.translate(0, 0.4, 0);
  return colorize(geom, 0x4a5d23);
}

function centerGeometry(geom: THREE.BufferGeometry): void {
  geom.computeBoundingSphere();
  if (geom.boundingSphere) {
    const c = geom.boundingSphere.center;
    geom.translate(-c.x, -c.y, -c.z);
  }
  geom.computeBoundingSphere();
}

export function createMandarinGeometry(): THREE.BufferGeometry {
  const geometries = [
    createFruit(),
    createLeaf(),
    createStem()
  ];
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  centerGeometry(merged);
  merged.rotateX(Math.PI / 2);
  return merged;
}
