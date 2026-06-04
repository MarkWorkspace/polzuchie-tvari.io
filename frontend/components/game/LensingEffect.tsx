import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '../../types/game';

interface LensingEffectProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  lastGameStateRef: React.MutableRefObject<GameState | null>;
  progressRef: React.MutableRefObject<number>;
  gridSize: number;
  camStateRef: React.MutableRefObject<{ camX: number; camY: number }>;
}

export const LensingEffect: React.FC<LensingEffectProps> = ({
  gameStateRef,
  lastGameStateRef,
  progressRef,
  gridSize,
  camStateRef
}) => {
  const { gl, scene, camera, size } = useThree();

  // Create RTT Target matching the viewport size
  const renderTarget = useMemo(() => {
    return new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
  }, []);

  // Update render target size when viewport resizes
  useEffect(() => {
    renderTarget.setSize(size.width, size.height);
  }, [size, renderTarget]);

  // Create fullscreen quad resources
  const postScene = useMemo(() => new THREE.Scene(), []);
  const postCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  
  const lensingMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uBlackHoles: { value: new Float32Array(30) }, // Up to 10 black holes (x, y screen UV, z screen pull radius)
        uBlackHoleCount: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uBlackHoles[10];
        uniform int uBlackHoleCount;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          vec2 totalDistortion = vec2(0.0);
          
          for (int i = 0; i < 10; i++) {
            if (i >= uBlackHoleCount) break;
            vec2 bhScreen = uBlackHoles[i].xy;
            float pullRadius = uBlackHoles[i].z;
            
            vec2 toBH = bhScreen - uv;
            float dist = length(toBH);
            if (dist < pullRadius && dist > 0.001) {
              // Einstein ring style gravitational lensing warp
              float force = (pullRadius - dist) / pullRadius;
              // Warp strength decays exponentially
              float warpStrength = pow(force, 2.5) * 0.08 * pullRadius;
              totalDistortion += normalize(toBH) * warpStrength;
            }
          }
          
          gl_FragColor = texture2D(tDiffuse, uv - totalDistortion);
        }
      `,
      depthWrite: false,
      depthTest: false
    });
  }, []);

  const quadMesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2, 2);
    return new THREE.Mesh(geo, lensingMaterial);
  }, [lensingMaterial]);

  useEffect(() => {
    postScene.add(quadMesh);
    return () => {
      quadMesh.geometry.dispose();
      lensingMaterial.dispose();
      renderTarget.dispose();
    };
  }, [postScene, quadMesh, lensingMaterial, renderTarget]);

  const bhPositionsArray = useMemo(() => new Float32Array(30), []);
  const tempVec3 = useMemo(() => new THREE.Vector3(), []);
  const tempProjected = useMemo(() => new THREE.Vector3(), []);

  // Main post-processing render hook
  useFrame(({ gl: coreGl }) => {
    const state = gameStateRef.current;
    if (!state || !state.black_holes || state.black_holes.length === 0) {
      // If no black holes, draw scene normally
      coreGl.setRenderTarget(null);
      coreGl.render(scene, camera);
      return;
    }

    const lastState = lastGameStateRef.current;
    const progress = progressRef.current;

    let bhCount = 0;
    const numBH = Math.min(state.black_holes.length, 10);

    for (let i = 0; i < numBH; i++) {
      const bh = state.black_holes[i];
      if (!bh) continue;

      const lastBh = lastState?.black_holes?.find((o) => o.id === bh.id);
      
      let pullRadius = bh.pull_radius;
      if (lastBh) {
        pullRadius = lastBh.pull_radius + (bh.pull_radius - lastBh.pull_radius) * progress;
      } else {
        pullRadius = bh.pull_radius * progress;
      }

      // Convert 3D world position
      const worldX = bh.x * gridSize + gridSize / 2;
      const worldY = -(bh.y * gridSize + gridSize / 2);
      const bhZ = 0.9;

      // 1. Transform to camera space to verify distance along the camera axis (depth)
      tempVec3.set(worldX, worldY, bhZ);
      tempVec3.applyMatrix4(camera.matrixWorldInverse);

      const cameraSpaceZ = tempVec3.z; // Negative if in front of camera
      const distToCamPlane = -cameraSpaceZ;

      // If behind camera or within the near clipping plane, skip to prevent screen distortion explosions
      if (distToCamPlane <= camera.near) {
        continue;
      }

      // Smoothly fade out the lensing effect when getting close to the near plane
      // to avoid visual pop-in/pop-out and division by zero artifacts
      const fadeStart = camera.near * 2.5; // Start fading out when within 2.5x near plane distance
      const fadeFactor = distToCamPlane < fadeStart 
        ? Math.max(0.0, (distToCamPlane - camera.near) / (fadeStart - camera.near))
        : 1.0;

      const effectivePullRadius = pullRadius * fadeFactor;
      if (effectivePullRadius <= 0.001) continue;

      // 2. Convert 3D world position to Screen Space NDC
      tempVec3.set(worldX, worldY, bhZ);
      tempVec3.project(camera);

      // NDC to Screen UV space [0, 1]
      const screenX = tempVec3.x * 0.5 + 0.5;
      const screenY = tempVec3.y * 0.5 + 0.5;

      // Project edge point to calculate screen-space pull radius
      tempProjected.set(worldX + effectivePullRadius * gridSize, worldY, bhZ);
      tempProjected.project(camera);
      
      const screenEdgeX = tempProjected.x * 0.5 + 0.5;
      const screenPullRadius = Math.min(Math.abs(screenEdgeX - screenX), 0.35); // Clamp max screen radius to prevent full-screen distortion

      // Store in uniforms flat array
      const idx = bhCount * 3;
      bhPositionsArray[idx + 0] = screenX;
      bhPositionsArray[idx + 1] = screenY;
      bhPositionsArray[idx + 2] = screenPullRadius;

      bhCount++;
    }

    lensingMaterial.uniforms.uBlackHoles.value = bhPositionsArray;
    lensingMaterial.uniforms.uBlackHoleCount.value = bhCount;
    lensingMaterial.uniforms.tDiffuse.value = renderTarget.texture;

    // 1. Render scene to offscreen target texture
    coreGl.setRenderTarget(renderTarget);
    coreGl.render(scene, camera);
    coreGl.setRenderTarget(null);

    // 2. Render fullscreen lensing quad to screen
    coreGl.render(postScene, postCamera);
  }, 1); // priority 1 to override default canvas rendering loop

  return null;
};

export default LensingEffect;
