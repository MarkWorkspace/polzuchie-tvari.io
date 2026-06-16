// ROLE: Процедурная генерация 3D-геометрии арбуза для FoodRenderer.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

function applyColor(geometry: THREE.BufferGeometry, colorHex: number) {
    const color = new THREE.Color(colorHex);
    const colors = [];
    const count = geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function prepareGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    let geom = geometry.clone();
    if (geom.index) {
        geom = geom.toNonIndexed();
    }
    
    const attributes = geom.attributes;
    for (const key in attributes) {
        if (key !== 'position' && key !== 'normal' && key !== 'color') {
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
    applyColor(bodyGeom, 0x114411);
    geometries.push(prepareGeometry(bodyGeom));

    // Хвостик
    const stemGeom = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8);
    stemGeom.translate(0, 1.2 + 0.15, 0);
    applyColor(stemGeom, 0x55aa55);
    geometries.push(prepareGeometry(stemGeom));

    const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
    if (!merged) {
        throw new Error("Failed to merge watermelon geometries");
    }

    merged.rotateX(Math.PI / 2);

    return merged;
}
