// ROLE: Процедурная генерация 3D-геометрии винограда. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const GRAPE_COLOR = 0x6a0dad;
const STEM_COLOR = 0x8b4513; // Коричневый

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

function createGrapes(): THREE.BufferGeometry[] {
  const geometries: THREE.BufferGeometry[] = [];
  const radius = 0.22;
  const positions: [number, number, number][] = [];
  
  // Нижний слой (одна виноградина)
  positions.push([0, 0, 0]);
  
  // Слой 1
  for(let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4;
    positions.push([Math.cos(angle) * 0.2, 0.3, Math.sin(angle) * 0.2]);
  }
  
  // Слой 2
  for(let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5;
    positions.push([Math.cos(angle) * 0.3, 0.6, Math.sin(angle) * 0.3]);
  }

  // Слой 3
  for(let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6;
    positions.push([Math.cos(angle) * 0.35, 0.9, Math.sin(angle) * 0.35]);
  }

  // Слой 4 (верх)
  for(let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 * i) / 4 + Math.PI / 4;
    positions.push([Math.cos(angle) * 0.2, 1.15, Math.sin(angle) * 0.2]);
  }

  for (const pos of positions) {
    const geom = new THREE.SphereGeometry(radius, 12, 12);
    geom.translate(pos[0], pos[1], pos[2]);
    geometries.push(colorize(geom, GRAPE_COLOR));
  }

  return geometries;
}

function createStem(): THREE.BufferGeometry {
  class StemCurve extends THREE.Curve<THREE.Vector3> {
    constructor() { super(); }
    getPoint(t: number, target = new THREE.Vector3()) {
      const x = Math.sin(t * Math.PI) * 0.1;
      const y = 1.25 + t * 0.35;
      const z = Math.cos(t * Math.PI) * 0.05;
      return target.set(x, y, z);
    }
  }
  const stem = new THREE.TubeGeometry(new StemCurve(), 8, 0.04, 8, false);
  return colorize(stem, STEM_COLOR);
}

function centerGeometry(geom: THREE.BufferGeometry): void {
  geom.computeBoundingSphere();
  if (geom.boundingSphere) {
    const c = geom.boundingSphere.center;
    geom.translate(-c.x, -c.y, -c.z);
  }
  geom.computeBoundingSphere();
}

export function createGrapeGeometry(): THREE.BufferGeometry {
  const geometries = [
    ...createGrapes(),
    createStem()
  ];
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  centerGeometry(merged);
  merged.rotateX(Math.PI / 2);
  return merged;
}
