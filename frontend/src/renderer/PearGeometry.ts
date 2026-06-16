// ROLE: Создает процедурную геометрию груши для рендеринга еды.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function createPearGeometry(): THREE.BufferGeometry {
    // Нижняя часть (большая сфера)
    const bottomSphere = new THREE.SphereGeometry(0.35, 16, 16);
    bottomSphere.translate(0, -0.15, 0);

    // Верхняя часть (малая сфера)
    const topSphere = new THREE.SphereGeometry(0.25, 16, 16);
    topSphere.translate(0, 0.2, 0);

    // Цвет груши (зеленый)
    const pearColor = new THREE.Color(0x88cc44);

    // Веточка (цилиндр)
    const stem = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    stem.translate(0, 0.5, 0);
    const stemColor = new THREE.Color(0x553311);

    const processGeometry = (geo: THREE.BufferGeometry, color: THREE.Color) => {
        let nonIndexedGeo = geo;
        if (geo.index) {
            nonIndexedGeo = geo.toNonIndexed();
        }

        const count = nonIndexedGeo.attributes.position.count;
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        nonIndexedGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const attributes = nonIndexedGeo.attributes;
        for (const key in attributes) {
            if (key !== 'position' && key !== 'normal' && key !== 'color') {
                nonIndexedGeo.deleteAttribute(key);
            }
        }
        return nonIndexedGeo;
    };

    const processedGeometries = [
        processGeometry(bottomSphere, pearColor),
        processGeometry(topSphere, pearColor),
        processGeometry(stem, stemColor)
    ];

    const merged = BufferGeometryUtils.mergeGeometries(processedGeometries);
    merged.rotateX(Math.PI / 2);

    // Очистка исходных геометрий (merged создает новые буферы)
    bottomSphere.dispose();
    topSphere.dispose();
    stem.dispose();
    for (const g of processedGeometries) {
        g.dispose();
    }

    return merged;
}
