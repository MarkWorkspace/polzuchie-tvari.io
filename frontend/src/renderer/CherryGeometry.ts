// ROLE: Процедурная генерация 3D-геометрии вишни. Не содержит инстансинга и рендеринга.
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

export function createCherryGeometry(): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  const colorize = (geom: THREE.BufferGeometry, hexColor: number) => {
    const color = new THREE.Color(hexColor);
    const count = geom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.deleteAttribute("uv");
    return geom;
  };

  const berryRadius = 0.4;
  const berryColor = 0xe63946;
  const stemColor = 0x2a9d8f;

  const berry1 = new THREE.SphereGeometry(berryRadius, 16, 16);
  berry1.translate(-0.4, 0, 0);
  geometries.push(colorize(berry1, berryColor));

  const berry2 = new THREE.SphereGeometry(berryRadius, 16, 16);
  berry2.translate(0.4, 0, 0);
  geometries.push(colorize(berry2, berryColor));

  class StemCurve1 extends THREE.Curve<THREE.Vector3> {
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
      const x = -0.4 * (1 - t);
      const y = 0.3 + 0.9 * t;
      const z = Math.sin(t * Math.PI) * 0.2;
      return optionalTarget.set(x, y, z);
    }
  }
  const stem1 = new THREE.TubeGeometry(new StemCurve1(), 12, 0.04, 8, false);
  geometries.push(colorize(stem1, stemColor));

  class StemCurve2 extends THREE.Curve<THREE.Vector3> {
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
      const x = 0.4 * (1 - t);
      const y = 0.3 + 0.9 * t;
      const z = Math.sin(t * Math.PI) * 0.2;
      return optionalTarget.set(x, y, z);
    }
  }
  const stem2 = new THREE.TubeGeometry(new StemCurve2(), 12, 0.04, 8, false);
  geometries.push(colorize(stem2, stemColor));

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.3, 0.3, 0.5, 0.0);
  leafShape.quadraticCurveTo(0.3, -0.3, 0, 0);

  const extrudeSettings = { depth: 0.02, bevelEnabled: false };
  const leafGeom = new THREE.ExtrudeGeometry(leafShape, extrudeSettings);
  
  leafGeom.translate(0, 0, -0.01);
  leafGeom.rotateZ(Math.PI / 4);
  leafGeom.rotateX(-Math.PI / 6);
  leafGeom.translate(0, 1.2, 0);
  geometries.push(colorize(leafGeom, stemColor));

  const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
  
  merged.computeBoundingSphere();
  if (merged.boundingSphere) {
    merged.translate(
      -merged.boundingSphere.center.x,
      -merged.boundingSphere.center.y,
      -merged.boundingSphere.center.z
    );
  }
  
  // Recompute sphere for culling
  merged.computeBoundingSphere();
  
  return merged;
}
