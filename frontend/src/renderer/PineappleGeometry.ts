// ROLE: Процедурная генерация 3D-геометрии ананаса. Не содержит инстансинга и рендеринга.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function createPineappleGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    const prepareGeometry = (geom: THREE.BufferGeometry, colorHex: number) => {
        let processed = geom.clone();
        if (processed.index) {
            processed = processed.toNonIndexed();
        }

        const color = new THREE.Color(colorHex);
        const count = processed.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        processed.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const attributesToKeep = ['position', 'normal', 'color'];
        for (const name of Object.keys(processed.attributes)) {
            if (!attributesToKeep.includes(name)) {
                processed.deleteAttribute(name);
            }
        }

        return processed;
    };

    // Pineapple Body (Yellow elongated cylinder/capsule)
    const bodyGeom = new THREE.CapsuleGeometry(0.25, 0.4, 4, 16);
    geometries.push(prepareGeometry(bodyGeom, 0xFFD700));

    // Pineapple Crown (Sharp green leaves)
    const leafCount = 8;
    for (let i = 0; i < leafCount; i++) {
        const leafGeom = new THREE.ConeGeometry(0.08, 0.5, 4);
        
        // Flatten leaf
        leafGeom.scale(1, 1, 0.2);
        // Translate up from local origin
        leafGeom.translate(0, 0.25, 0);

        // Rotate outward and arrange in a circle
        const angle = (i / leafCount) * Math.PI * 2;
        leafGeom.rotateX(0.5); // outward tilt
        leafGeom.rotateY(angle);

        // Position on top of the body
        leafGeom.translate(0, 0.35, 0);
        
        geometries.push(prepareGeometry(leafGeom, 0x228B22));
    }

    // Add a straight central leaf
    const topLeaf = new THREE.ConeGeometry(0.08, 0.6, 4);
    topLeaf.scale(1, 1, 0.2);
    topLeaf.translate(0, 0.3, 0);
    topLeaf.translate(0, 0.4, 0);
    geometries.push(prepareGeometry(topLeaf, 0x32CD32));

    const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
    if (!mergedGeometry) {
        throw new Error('Failed to merge pineapple geometries');
    }

    // Final rotation
    mergedGeometry.rotateX(Math.PI / 2);

    return mergedGeometry;
}
