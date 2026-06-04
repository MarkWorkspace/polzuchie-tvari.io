import React from 'react';
import * as THREE from 'three';
import { flatCircleGeo, portalDiskMat, portalRingMat } from './materials';

interface PortalsMeshProps {
  portalDiskMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  portalRingMeshRef: React.RefObject<THREE.InstancedMesh | null>;
}

export const PortalsMesh: React.FC<PortalsMeshProps> = ({ portalDiskMeshRef, portalRingMeshRef }) => {
  return (
    <>
      <instancedMesh 
        ref={portalDiskMeshRef} 
        args={[flatCircleGeo, portalDiskMat, 100]} 
        frustumCulled={false} 
        renderOrder={3} 
      />
      <instancedMesh 
        ref={portalRingMeshRef} 
        args={[flatCircleGeo, portalRingMat, 100]} 
        frustumCulled={false} 
        renderOrder={4} 
      />
    </>
  );
};
