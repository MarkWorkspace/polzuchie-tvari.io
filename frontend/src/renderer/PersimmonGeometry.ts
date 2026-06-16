// ROLE: Процедурная генерация 3D-геометрии хурмы. Не содержит логики рендеринга.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function createPersimmonGeometry(): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];

    // Основная сфера хурмы
    const persimmonGeo = new THREE.SphereGeometry(1, 16, 16);
    persimmonGeo.scale(1, 0.85, 1); // Слегка приплюснутая форма

    const orangeColor = new THREE.Color(0xff6600);
    const persimmonColors = [];
    for (let i = 0; i < persimmonGeo.attributes.position.count; i++) {
        persimmonColors.push(orangeColor.r, orangeColor.g, orangeColor.b);
    }
    persimmonGeo.setAttribute('color', new THREE.Float32BufferAttribute(persimmonColors, 3));

    let nonIndexedPersimmon = persimmonGeo.toNonIndexed();
    for (const key in nonIndexedPersimmon.attributes) {
        if (key !== 'position' && key !== 'normal' && key !== 'color') {
            nonIndexedPersimmon.deleteAttribute(key);
        }
    }
    geometries.push(nonIndexedPersimmon);

    // 4 листика сверху
    const leafColor = new THREE.Color(0x33aa33);
    for (let i = 0; i < 4; i++) {
        const leafGeo = new THREE.PlaneGeometry(0.5, 0.6);
        
        // Центр вращения - у основания листика
        leafGeo.translate(0, 0.3, 0);
        
        // Укладываем листик
        leafGeo.rotateX(-Math.PI / 2.2);
        
        // Размещаем крест-накрест
        leafGeo.rotateY((i * Math.PI) / 2);
        
        // Поднимаем наверх хурмы
        leafGeo.translate(0, 0.8, 0);

        const leafColors = [];
        for (let j = 0; j < leafGeo.attributes.position.count; j++) {
            leafColors.push(leafColor.r, leafColor.g, leafColor.b);
        }
        leafGeo.setAttribute('color', new THREE.Float32BufferAttribute(leafColors, 3));

        let nonIndexedLeaf = leafGeo.toNonIndexed();
        // Генерируем нормали (если они почему-то некорректны) или полагаемся на дефолтные нормали PlaneGeometry
        for (const key in nonIndexedLeaf.attributes) {
            if (key !== 'position' && key !== 'normal' && key !== 'color') {
                nonIndexedLeaf.deleteAttribute(key);
            }
        }
        geometries.push(nonIndexedLeaf);
    }

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    merged.rotateX(Math.PI / 2);

    return merged;
}
