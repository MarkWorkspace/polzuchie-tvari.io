// ROLE: Процедурная генерация 3D-геометрии персика. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const PEACH_COLOR = 0xffa07a; // розовато-оранжевый (LightSalmon)
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

function createPeachBody(): THREE.BufferGeometry {
  const radius = 0.5;
  const geom = new THREE.SphereGeometry(radius, 32, 32);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    
    // Создаем бороздку (crease) вдоль оси Z, с одной стороны (x > 0)
    if (v.x > 0) {
      const zDist = Math.abs(v.z);
      if (zDist < 0.2) {
        const depth = (0.2 - zDist) * 0.6;
        const yFactor = 1.0 - Math.abs(v.y) / radius;
        v.x -= depth * Math.max(0, yFactor);
      }
    }
    
    // Немного сплющиваем сверху и снизу
    v.y *= 0.95;
    
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return colorize(geom, PEACH_COLOR);
}

function createLeaf(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.2, 0.2, 0.4, 0.0);
  shape.quadraticCurveTo(0.2, -0.2, 0, 0);
  
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false });
  geom.translate(0, 0, -0.005);
  // Наклоняем и прикрепляем к макушке
  geom.rotateZ(Math.PI / 4);
  geom.rotateX(Math.PI / 6);
  geom.translate(0, 0.45, 0);
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

export function createPeachGeometry(): THREE.BufferGeometry {
  const geometries = [
    createPeachBody(),
    createLeaf()
  ];
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  centerGeometry(merged);
  merged.rotateX(Math.PI / 2);
  return merged;
}
