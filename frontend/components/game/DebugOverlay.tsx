import React from 'react';
import * as THREE from 'three';

interface DebugOverlayProps {
  debugMode: boolean;
  debugGridLines: Float32Array | null;
  debugGeometryRef: React.RefObject<THREE.BufferGeometry | null>;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  debugMode,
  debugGridLines,
  debugGeometryRef
}) => {
  return (
    <>
      {debugGridLines && (
        <lineSegments renderOrder={5}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[debugGridLines, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#22c55e" opacity={0.35} transparent />
        </lineSegments>
      )}

      {debugMode && (
        <lineSegments renderOrder={10}>
          <bufferGeometry ref={debugGeometryRef} />
          <lineBasicMaterial vertexColors depthTest={false} transparent opacity={0.8} />
        </lineSegments>
      )}
    </>
  );
};
export default DebugOverlay;
