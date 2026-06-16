// ROLE: Процедурная 3D-геометрия дыни (вытянутая желто-зеленая сфера).

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function createMelonGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Создаем сферу
    const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
    // Делаем ее вытянутой (овал)
    sphereGeo.scale(1, 1.4, 1);

    // Добавляем цвета вершин (желто-зеленый цвет)
    const baseColor = new THREE.Color(0xadff2f); // GreenYellow
    const colors = new Float32Array(sphereGeo.attributes.position.count * 3);

    for (let i = 0; i < sphereGeo.attributes.position.count; i++) {
        // Немного варьируем цвет для текстурности (полосатость)
        const x = sphereGeo.attributes.position.getX(i);
        const z = sphereGeo.attributes.position.getZ(i);
        
        // Угол в плоскости XZ
        const angle = Math.atan2(z, x);
        const stripe = Math.sin(angle * 10);
        
        const color = baseColor.clone();
        if (stripe > 0.5) {
            color.lerp(new THREE.Color(0x228b22), 0.3); // ForestGreen
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    sphereGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Преобразуем в неиндексированную геометрию
    const nonIndexed = sphereGeo.toNonIndexed();

    // Очищаем лишние атрибуты
    const attributesToKeep = ['position', 'normal', 'color'];
    for (const name in nonIndexed.attributes) {
        if (!attributesToKeep.includes(name)) {
            nonIndexed.deleteAttribute(name);
        }
    }

    geometries.push(nonIndexed);

    // Объединяем геометрии (хотя здесь она одна, следуем правилу использовать mergeGeometries)
    const merged = BufferGeometryUtils.mergeGeometries(geometries, false);
    if (!merged) {
        throw new Error('Failed to merge melon geometries');
    }

    // Поворачиваем финальную геометрию
    merged.rotateX(Math.PI / 2);

    return merged;
}
