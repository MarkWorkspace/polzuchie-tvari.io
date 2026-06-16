import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ROLE: Процедурная генерация 3D-геометрии клубники (Strawberry)

function colorize(geom: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
    const nonIndexed = geom.toNonIndexed();
    const count = nonIndexed.attributes.position.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const attributes = nonIndexed.attributes;
    for (const key in attributes) {
        if (key !== 'position' && key !== 'normal' && key !== 'color') {
            nonIndexed.deleteAttribute(key);
        }
    }

    return nonIndexed;
}

export function createStrawberryGeometry(): THREE.BufferGeometry {
    const bodyColor = new THREE.Color(0xe01a3c); // Ярко-красный
    const leafColor = new THREE.Color(0x3a8a24); // Зеленый

    // --- 1. Тело клубники (деформированная сфера) ---
    let bodyGeom = new THREE.SphereGeometry(0.35, 16, 16);
    const pos = bodyGeom.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        // y изменяется от -0.35 (низ) до 0.35 (верх)
        // Нормализуем y от 0 до 1
        let ny = (y + 0.35) / 0.7; 
        
        // Масштабируем x и z так, чтобы сверху было шире, а снизу уже
        let scale = 0.3 + 0.8 * ny; 
        
        // Слегка вытянем по оси y для придания формы конуса
        let newY = y * 1.2;

        pos.setX(i, pos.getX(i) * scale);
        pos.setZ(i, pos.getZ(i) * scale);
        pos.setY(i, newY);
    }
    
    // Пересчитываем нормали после изменения формы
    bodyGeom.computeVertexNormals();
    const coloredBody = colorize(bodyGeom, bodyColor);

    // --- 2. Листики на верхушке ---
    const leaves: THREE.BufferGeometry[] = [];
    const numLeaves = 6;
    
    for (let i = 0; i < numLeaves; i++) {
        const leaf = new THREE.ConeGeometry(0.08, 0.3, 4);
        const angle = (i / numLeaves) * Math.PI * 2;
        
        // Поворачиваем конус так, чтобы он указывал "наружу" от центра
        leaf.rotateX(Math.PI / 2 - 0.2); 
        // Сдвигаем по оси Z от центра
        leaf.translate(0, 0.05, 0.15); 
        
        // Вращаем по кругу (ось Y)
        leaf.rotateY(angle);
        
        // Сдвигаем наверх клубники (верхняя часть тела где-то на y = 0.35 * 1.2 = 0.42)
        leaf.translate(0, 0.4, 0);
        
        leaves.push(colorize(leaf, leafColor));
    }

    // --- 3. Хвостик (стебелёк) ---
    const stem = new THREE.CylinderGeometry(0.02, 0.03, 0.15, 5);
    stem.translate(0, 0.48, 0);
    const coloredStem = colorize(stem, leafColor);

    // --- Слияние геометрий ---
    const merged = mergeGeometries([coloredBody, ...leaves, coloredStem]);

    // Поворот по оси X как указано в задании
    merged.rotateX(Math.PI / 2);

    return merged;
}
