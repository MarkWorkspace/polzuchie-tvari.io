import React from 'react';
import * as THREE from 'three';
import { planeGeo, foodMat, foodShadowMat } from './materials';

interface FoodsMeshProps {
  foodMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  foodShadowMeshRef: React.RefObject<THREE.InstancedMesh | null>;
}

export const FoodsMesh: React.FC<FoodsMeshProps> = ({ foodMeshRef, foodShadowMeshRef }) => {
  return (
    <>
      <instancedMesh 
        ref={foodShadowMeshRef} 
        args={[planeGeo, foodShadowMat, 5000]} 
        frustumCulled={false} 
        renderOrder={0} 
      />
      <instancedMesh 
        ref={foodMeshRef} 
        args={[planeGeo, foodMat, 5000]} 
        frustumCulled={false} 
        renderOrder={1} 
      />
    </>
  );
};
