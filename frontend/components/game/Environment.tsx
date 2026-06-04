import React from 'react';
import * as THREE from 'three';
import { groundMaterial } from './materials';
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from './constants';

interface EnvironmentProps {
  groundMeshRef: React.RefObject<THREE.Mesh | null>;
}

export const Environment: React.FC<EnvironmentProps> = ({ groundMeshRef }) => {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[100, 100, 200]} intensity={1.2} />
      
      {/* Custom Infinite Floor with Fog and Grid */}
      <mesh 
        ref={groundMeshRef} 
        position={[(WORLD_WIDTH * gridSize) / 2, -(WORLD_HEIGHT * gridSize) / 2, -2.0]}
      >
        <planeGeometry args={[WORLD_WIDTH * gridSize * 4, WORLD_HEIGHT * gridSize * 4]} />
        <primitive object={groundMaterial} attach="material" />
      </mesh>
    </>
  );
};
