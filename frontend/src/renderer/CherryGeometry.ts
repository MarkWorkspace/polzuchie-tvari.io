// ROLE: Процедурная генерация 3D-геометрии вишни. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

const BERRY_COLOR = 0xe63946;
const STEM_COLOR = 0x2a9d8f;

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

function createBerries(): THREE.BufferGeometry[] {
  const b1 = new THREE.SphereGeometry(0.4, 16, 16);
  b1.translate(-0.4, 0, 0);
  const b2 = new THREE.SphereGeometry(0.4, 16, 16);
  b2.translate(0.4, 0, 0);
  return [colorize(b1, BERRY_COLOR), colorize(b2, BERRY_COLOR)];
}

function createStems(): THREE.BufferGeometry[] {
  class StemCurve extends THREE.Curve<THREE.Vector3> {
    sign: number;
    constructor(sign: number) {
      super();
      this.sign = sign;
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const x = this.sign * 0.4 * (1 - t);
      const y = 0.3 + 0.9 * t;
      return target.set(x, y, Math.sin(t * Math.PI) * 0.2);
    }
  }
  const s1 = new THREE.TubeGeometry(new StemCurve(-1), 12, 0.04, 8, false);
  const s2 = new THREE.TubeGeometry(new StemCurve(1), 12, 0.04, 8, false);
  return [colorize(s1, STEM_COLOR), colorize(s2, STEM_COLOR)];
}

function createLeaf(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.3, 0.3, 0.5, 0.0);
  shape.quadraticCurveTo(0.3, -0.3, 0, 0);

  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false });
  geom.translate(0, 0, -0.01);
  geom.rotateZ(Math.PI / 4);
  geom.rotateX(-Math.PI / 6);
  geom.translate(0, 1.2, 0);
  return colorize(geom, STEM_COLOR);
}

function centerGeometry(geom: THREE.BufferGeometry): void {
  geom.computeBoundingSphere();
  if (geom.boundingSphere) {
    const c = geom.boundingSphere.center;
    geom.translate(-c.x, -c.y, -c.z);
  }
  geom.computeBoundingSphere();
}

export function createCherryGeometry(): THREE.BufferGeometry {
  const geometries = [...createBerries(), ...createStems(), createLeaf()];
  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  centerGeometry(merged);
  merged.rotateX(Math.PI / 2);
  return merged;
}
