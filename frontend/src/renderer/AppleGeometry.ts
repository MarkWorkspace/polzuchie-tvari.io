// ROLE: Процедурная генерация 3D-геометрии яблока. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const APPLE_COLOR = 0xff3333; // красный
const STEM_COLOR = 0x654321;  // коричневый
const LEAF_COLOR = 0x2a9d8f;  // зеленый

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

function createAppleBody(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.5, 16, 16);
  // Вдавливаем сверху и снизу
  body.scale(1, 0.85, 1);
  return colorize(body, APPLE_COLOR);
}

function createStem(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  stem.translate(0, 0.45, 0);
  stem.rotateZ(0.1); // немного наклоним
  return colorize(stem, STEM_COLOR);
}

function createLeaf(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.2, 0.2, 0.4, 0.0);
  shape.quadraticCurveTo(0.2, -0.2, 0, 0);
  
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false });
  geom.translate(0, 0, -0.005);
  geom.rotateZ(Math.PI / 4);
  geom.rotateX(-Math.PI / 6);
  geom.translate(0.05, 0.5, 0);
  return colorize(geom, LEAF_COLOR);
}

function centerGeometry(geom: THREE.BufferGeometry): void {
  geom.computeBoundingSphere();
  if (geom.boundingSphere) {
    const c = geom.boundingSphere.center;
    geom.translate(-c.x, -c.y, -c.z);
  }
  geom.computeBoundingSphere();
}

export function createAppleGeometry(): THREE.BufferGeometry {
  const geometries = [
    createAppleBody(),
    createStem(),
    createLeaf()
  ];
  
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  centerGeometry(merged);
  merged.rotateX(Math.PI / 2);
  
  return merged;
}
