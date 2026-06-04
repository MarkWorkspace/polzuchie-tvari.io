import React from 'react';
import * as THREE from 'three';
import { flatCircleGeo, blackHoleGravityMat, blackHoleRingMat, blackHoleCoreMat } from './materials';

interface BlackHolesMeshProps {
  blackHoleCoreMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  blackHoleRingMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  blackHoleGravityMeshRef: React.RefObject<THREE.InstancedMesh | null>;
}

export const BlackHolesMesh: React.FC<BlackHolesMeshProps> = ({
  blackHoleCoreMeshRef,
  blackHoleRingMeshRef,
  blackHoleGravityMeshRef
}) => {
  return (
    <>
      <instancedMesh 
        ref={blackHoleGravityMeshRef} 
        args={[flatCircleGeo, blackHoleGravityMat, 100]} 
        frustumCulled={false} 
        renderOrder={2} 
      />
      <instancedMesh 
        ref={blackHoleRingMeshRef} 
        args={[flatCircleGeo, blackHoleRingMat, 100]} 
        frustumCulled={false} 
        renderOrder={3} 
      />
      <instancedMesh 
        ref={blackHoleCoreMeshRef} 
        args={[flatCircleGeo, blackHoleCoreMat, 100]} 
        frustumCulled={false} 
        renderOrder={4} 
      />
    </>
  );
};
