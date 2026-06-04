import React from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { 
  flatCircleGeo, 
  pupilGeo, 
  particleGeo, 
  eyeMat, 
  pupilMat, 
  particleMat, 
  snakeMat, 
  shadowMat 
} from './materials';

interface SnakeGroupProps {
  snakeMeshRef: React.RefObject<THREE.Mesh | null>;
  snakeShadowMeshRef: React.RefObject<THREE.Mesh | null>;
  bodyGeometryRef: React.RefObject<THREE.BufferGeometry | null>;
  shadowGeometryRef: React.RefObject<THREE.BufferGeometry | null>;
  eyeMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  pupilMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  particleMeshRef: React.RefObject<THREE.InstancedMesh | null>;
  activePlayerIds: { id: string; isMe: boolean; nickname: string }[];
  textRefs: React.MutableRefObject<Record<string, any>>;
}

export const SnakeGroup: React.FC<SnakeGroupProps> = ({
  snakeMeshRef,
  snakeShadowMeshRef,
  bodyGeometryRef,
  shadowGeometryRef,
  eyeMeshRef,
  pupilMeshRef,
  particleMeshRef,
  activePlayerIds,
  textRefs
}) => {
  return (
    <>
      <mesh ref={snakeShadowMeshRef} renderOrder={1} frustumCulled={false}>
        <bufferGeometry ref={shadowGeometryRef} />
        <primitive object={shadowMat} attach="material" />
      </mesh>
      <mesh ref={snakeMeshRef} renderOrder={2} frustumCulled={false}>
        <bufferGeometry ref={bodyGeometryRef} />
        <primitive object={snakeMat} attach="material" />
      </mesh>
      <instancedMesh ref={eyeMeshRef} args={[flatCircleGeo, eyeMat, 2000]} frustumCulled={false} />
      <instancedMesh ref={pupilMeshRef} args={[pupilGeo, pupilMat, 2000]} frustumCulled={false} />
      <instancedMesh ref={particleMeshRef} args={[particleGeo, particleMat, 2000]} frustumCulled={false} />
      
      {activePlayerIds.filter((n) => !n.isMe).map((n) => {
        return (
          <Text
            key={n.id}
            ref={(r) => {
              if (r) {
                textRefs.current[n.id] = r;
              } else {
                delete textRefs.current[n.id];
              }
            }}
            position={[0, 0, 0]}
            fontSize={10}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={2}
            outlineColor="#000000"
          >
            {n.nickname}
          </Text>
        );
      })}
    </>
  );
};
export default SnakeGroup;
