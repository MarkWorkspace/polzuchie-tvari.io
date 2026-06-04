import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GameState } from '../types/game';
import { t } from '../lib/i18n';

// Constants
import {
  DEFAULT_SERVER_TICK_RATE,
  BASE_HEAD_RADIUS,
  SCORE_THICKNESS_SCALE,
  CAMERA_ZOOM_OUT_COEFF,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  gridSize
} from './game/constants';

// Materials & Shared Shaders
import {
  planeGeo,
  flatCircleGeo,
  pupilGeo,
  particleGeo,
  shadowMat,
  snakeMat,
  foodShadowMat,
  foodMat,
  eyeMat,
  pupilMat,
  particleMat,
  portalDiskMat,
  portalRingMat,
  blackHoleCoreMat,
  blackHoleRingMat,
  blackHoleGravityMat,
  groundMaterial,
  evaluateFormula
} from './game/materials';

// Decoupled JSX components
import { Environment } from './game/Environment';
import { FoodsMesh } from './game/FoodsMesh';
import { PortalsMesh } from './game/PortalsMesh';
import { BlackHolesMesh } from './game/BlackHolesMesh';
import { SnakeGroup } from './game/SnakeGroup';
import { DebugOverlay } from './game/DebugOverlay';
import { LensingEffect } from './game/LensingEffect';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  life: number;
}

interface GameSceneProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  lastGameStateRef: React.MutableRefObject<GameState | null>;
  lastUpdateTimeRef: React.MutableRefObject<number>;
  stateQueueRef: React.MutableRefObject<{ time: number; state: GameState }[]>;
  myIdRef: React.MutableRefObject<string>;
  cameraModeRef: React.MutableRefObject<"2D" | "3D">;
  localInputRef: React.MutableRefObject<{ turn: number; accelerating: boolean; touchX?: number | null; tiltX?: number | null }>;
  particlesRef: React.MutableRefObject<Particle[]>;
  controlModeRef: React.MutableRefObject<"keyboard" | "mouse" | "tilt">;
  socketRef: React.MutableRefObject<any>;
  isMobile?: boolean;
  debugMode?: boolean;
  workerRef: React.MutableRefObject<Worker | null>;
  latestFrameDataRef: React.MutableRefObject<any>;
  isWaitingForFrameRef: React.MutableRefObject<boolean>;
}

function updateDynamicAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
  data: Float32Array | number[],
  itemSize: number
) {
  let attr = geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
  const requiredLength = data.length;
  
  if (!attr || attr.array.length < requiredLength) {
    const newSize = Math.max(Math.ceil(requiredLength * 1.3), 512);
    const newArray = new Float32Array(newSize);
    newArray.set(data);
    attr = new THREE.BufferAttribute(newArray, itemSize);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
  } else {
    const array = attr.array as Float32Array;
    array.set(data);
    attr.needsUpdate = true;
  }
}

function updateDynamicIndex(
  geometry: THREE.BufferGeometry,
  indices: Uint32Array | number[]
) {
  let indexAttr = geometry.getIndex();
  const requiredLength = indices.length;
  
  if (!indexAttr || indexAttr.array.length < requiredLength) {
    const newSize = Math.max(Math.ceil(requiredLength * 1.3), 512);
    const newArray = new Uint32Array(newSize);
    newArray.set(indices);
    indexAttr = new THREE.BufferAttribute(newArray, 1);
    indexAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(indexAttr);
  } else {
    const array = indexAttr.array as Uint32Array;
    array.set(indices);
    indexAttr.needsUpdate = true;
  }
}

const GameScene = ({
  gameStateRef,
  lastGameStateRef,
  lastUpdateTimeRef,
  stateQueueRef,
  myIdRef,
  cameraModeRef,
  localInputRef,
  particlesRef,
  controlModeRef,
  socketRef,
  isMobile,
  debugMode,
  workerRef,
  latestFrameDataRef,
  isWaitingForFrameRef
}: GameSceneProps) => {
  const { camera, scene } = useThree();
  const groundMeshRef = useRef<THREE.Mesh>(null);
  const foodMeshRef = useRef<THREE.InstancedMesh>(null);
  const foodShadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const snakeMeshRef = useRef<THREE.Mesh>(null);
  const snakeShadowMeshRef = useRef<THREE.Mesh>(null);
  const bodyGeometryRef = useRef<THREE.BufferGeometry>(null);
  const shadowGeometryRef = useRef<THREE.BufferGeometry>(null);
  const eyeMeshRef = useRef<THREE.InstancedMesh>(null);
  const pupilMeshRef = useRef<THREE.InstancedMesh>(null);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  
  const portalRingMeshRef = useRef<THREE.InstancedMesh>(null);
  const portalDiskMeshRef = useRef<THREE.InstancedMesh>(null);
  const blackHoleGravityMeshRef = useRef<THREE.InstancedMesh>(null);
  const blackHoleRingMeshRef = useRef<THREE.InstancedMesh>(null);
  const blackHoleCoreMeshRef = useRef<THREE.InstancedMesh>(null);

  const textRefs = useRef<Record<string, any>>({});
  const lastSentTurnRef = useRef(0.0);
  const lastSentTimeRef = useRef(0);
  const [activePlayerIds, setActivePlayerIds] = useState<{id: string, isMe: boolean, nickname: string}[]>([]);
  
  const debugGeometryRef = useRef<THREE.BufferGeometry>(null);

  const debugGridLines = useMemo(() => {
    if (!debugMode || !gameStateRef.current) return null;
    const mapW = gameStateRef.current.server_world?.width ?? WORLD_WIDTH;
    const mapH = gameStateRef.current.server_world?.height ?? WORLD_HEIGHT;
    
    const points: number[] = [];
    const cellW = 10 * gridSize;
    const cellH = 10 * gridSize;
    
    for (let x = 0; x <= mapW * gridSize; x += cellW) {
      points.push(x, 0, -1.9, x, -mapH * gridSize, -1.9);
    }
    for (let y = 0; y <= mapH * gridSize; y += cellH) {
      points.push(0, -y, -1.9, mapW * gridSize, -y, -1.9);
    }
    return new Float32Array(points);
  }, [debugMode, gameStateRef.current?.server_world?.width, gameStateRef.current?.server_world?.height]);

  const camState = useRef({
    lastFrameTime: performance.now(),
    localAngle: null as number | null,
    localCurrentTurn: 0.0,
    currentZoomOffset: 0.0,
    transition: cameraModeRef.current === '3D' ? 1.0 : 0.0,
    currentFov: 50.0,
  });

  const progressRef = useRef(1.0);
  const lensingCamStateRef = useRef({ camX: 0, camY: 0 });

  useFrame((r3fState) => {
    const time = performance.now();
    let dt = (time - camState.current.lastFrameTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    camState.current.lastFrameTime = time;

    // Calculate analog steering turn factor for mouse, touch, and tilt control modes
    const state = gameStateRef.current;
    const playerEntity = state?.players[myIdRef.current];
    if (state && playerEntity && (controlModeRef.current === "mouse" || controlModeRef.current === "tilt")) {
      const sensitivity = state.server_visual?.mouse_sensitivity ?? 1.0;
      const targetDeflection = 0.5 * sensitivity;

      let pointerX = 0.0;
      if (controlModeRef.current === "tilt") {
        pointerX = (localInputRef.current.tiltX !== undefined && localInputRef.current.tiltX !== null)
          ? localInputRef.current.tiltX
          : 0.0;
      } else if (isMobile) {
        pointerX = (localInputRef.current.touchX !== undefined && localInputRef.current.touchX !== null)
          ? localInputRef.current.touchX
          : 0.0;
      } else {
        pointerX = r3fState.pointer.x;
      }

      let desiredTurnFactor = 0.0;
      // Small deadzone of 0.02 (1% of screen half-width) to easily travel straight
      if (Math.abs(pointerX) > 0.02) {
        desiredTurnFactor = pointerX / targetDeflection;
        desiredTurnFactor = Math.max(-1.0, Math.min(1.0, desiredTurnFactor));
      }

      // Direct DOM update of the turn indicator elements for 60FPS fluid lag-free updates
      const needleEl = document.getElementById("mouse-turn-needle");
      const fillEl = document.getElementById("mouse-turn-fill");
      if (needleEl) {
        // desiredTurnFactor is from -1.0 to 1.0. Map it to percentage: -1.0 -> 0%, 0.0 -> 50%, 1.0 -> 100%.
        const percent = (desiredTurnFactor + 1) * 50;
        needleEl.style.left = `${percent}%`;
        if (Math.abs(desiredTurnFactor) > 0.95) {
          needleEl.style.backgroundColor = "#e63946";
          needleEl.style.boxShadow = "0 0 10px #e63946";
        } else if (Math.abs(desiredTurnFactor) > 0.02) {
          needleEl.style.backgroundColor = "#3b82f6";
          needleEl.style.boxShadow = "0 0 8px #3b82f6";
        } else {
          needleEl.style.backgroundColor = "#fafafa";
          needleEl.style.boxShadow = "0 0 6px rgba(255,255,255,0.5)";
        }
      }
      if (fillEl) {
        // Show fill from center (50%) to the active deflection
        if (desiredTurnFactor >= 0) {
          fillEl.style.left = "50%";
          fillEl.style.width = `${desiredTurnFactor * 50}%`;
          fillEl.style.background = "linear-gradient(90deg, #3b82f6, #4ade80)";
        } else {
          // Negative desiredTurnFactor: fill goes left from center
          const widthPercent = -desiredTurnFactor * 50;
          fillEl.style.left = `${50 - widthPercent}%`;
          fillEl.style.width = `${widthPercent}%`;
          fillEl.style.background = "linear-gradient(90deg, #f87171, #3b82f6)";
        }
      }

      // Update local input ref immediately for smooth visual camera alignment
      localInputRef.current.turn = desiredTurnFactor;

      // Throttle updates: send at most 20 updates per second (every 50ms),
      // or instantly when resetting back to 0.0 to prevent drifting.
      const throttleInterval = 50; 
      const isSignificantlyDifferent = Math.abs(desiredTurnFactor - lastSentTurnRef.current) > 0.06;
      const isResetting = desiredTurnFactor === 0 && lastSentTurnRef.current !== 0;

      if (isResetting || (isSignificantlyDifferent && (time - lastSentTimeRef.current > throttleInterval))) {
        const sock = socketRef.current;
        if (sock && sock.readyState === WebSocket.OPEN) {
          sock.send(`TURN:${desiredTurnFactor.toFixed(3)}`);
          lastSentTurnRef.current = desiredTurnFactor;
          lastSentTimeRef.current = time;
        }
      }
    }

    // 1. Handshake request to background Web Worker for spline interpolation and geometry generation
    if (workerRef?.current && !isWaitingForFrameRef.current) {
      isWaitingForFrameRef.current = true;
      workerRef.current.postMessage({
        type: "REQUEST_FRAME",
        dt: dt,
        myId: myIdRef.current,
        cameraMode: cameraModeRef.current,
        localInput: {
          turn: localInputRef.current.turn,
          accelerating: localInputRef.current.accelerating,
          mode: controlModeRef.current
        }
      });
    }

    const msg = latestFrameDataRef.current;
    if (!msg) return;

    // 2. Extract configuration metadata
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    if (groundMeshRef.current) {
      groundMeshRef.current.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
      groundMeshRef.current.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);
    }

    const serverSnakeConfig = msg.gameState?.server_snake;
    const baseHeadRadius = serverSnakeConfig?.base_head_radius ?? BASE_HEAD_RADIUS;
    const scoreThicknessScale = serverSnakeConfig?.score_thickness_scale ?? SCORE_THICKNESS_SCALE;
    const cameraZoomOutCoeff = serverSnakeConfig?.camera_zoom_out_coeff ?? CAMERA_ZOOM_OUT_COEFF;
    const startLength = serverSnakeConfig?.start_length ?? 5;

    let myLength = startLength;
    const myPlayer = msg.gameState?.players[myIdRef.current];
    if (myPlayer && myPlayer.body) {
      myLength = myPlayer.body.length;
    }
    const myEffectiveLengthGained = Math.max(0, myLength - startLength);

    const cameraBaseZoom = msg.gameState?.server_visual?.camera_base_zoom ?? 1.0;
    const cameraPitchAngle = msg.gameState?.server_visual?.camera_pitch_angle ?? 55.0;
    const cameraZHeightOffset = msg.gameState?.server_visual?.camera_z_height ?? 0.0;
    const cameraYOffset = msg.gameState?.server_visual?.camera_y_offset ?? 0.25;

    if (myPlayer) {
      if (myPlayer.accelerating || localInputRef.current.accelerating) {
        camState.current.currentZoomOffset = Math.min(1, camState.current.currentZoomOffset + 3.0 * dt);
      } else {
        camState.current.currentZoomOffset = Math.max(0, camState.current.currentZoomOffset - 3.0 * dt);
      }
    }

    // Smoothly transition between 2D and 3D mode
    const targetTransition = cameraModeRef.current === '3D' ? 1.0 : 0.0;
    camState.current.transition += (targetTransition - camState.current.transition) * dt * 6.0;
    if (Math.abs(targetTransition - camState.current.transition) < 0.005) {
      camState.current.transition = targetTransition;
    }
    const cameraTransition = camState.current.transition;

    const zoom2D = 1.0 - camState.current.currentZoomOffset * 0.05;
    const scoreZoomFactor = 1.0 / (1.0 + (myEffectiveLengthGained * 10.0) * (cameraZoomOutCoeff * 1e-5));
    const globalScale = (zoom2D + (1 - zoom2D) * cameraTransition) * scoreZoomFactor * cameraBaseZoom;

    // Fixed FOV and scale camera height to zoom
    const distance = (1500 / globalScale) + cameraZHeightOffset;
    const pitch = (cameraPitchAngle * Math.PI / 180) * cameraTransition;

    const camAngle = msg.camAngle ?? 0.0;
    const trueCamAngle = -camAngle;

    // Orbit camera backwards based on pitch to keep the snake in the center of view
    const dirB_x = -Math.cos(trueCamAngle);
    const dirB_y = -Math.sin(trueCamAngle);

    const orbitCamX = msg.camX + dirB_x * distance * Math.sin(pitch);
    const orbitCamY = msg.camY + dirB_y * distance * Math.sin(pitch);
    const orbitCamZ = distance * Math.cos(pitch);

    // Offset camera forwards along the ground to shift snake lower on the screen
    const offsetDistance = 1000 * cameraYOffset * cameraTransition / globalScale;
    const finalCamX = orbitCamX + Math.cos(trueCamAngle) * offsetDistance;
    const finalCamY = orbitCamY + Math.sin(trueCamAngle) * offsetDistance;

    camera.position.set(finalCamX, finalCamY, orbitCamZ);
    camera.rotation.order = 'ZYX';
    camera.rotation.set(0, 0, trueCamAngle - Math.PI / 2);
    camera.rotateX(pitch);

    // FOV acceleration effect
    const targetFov = (myPlayer?.accelerating || localInputRef.current.accelerating) ? 70.0 : 50.0;
    camState.current.currentFov += (targetFov - camState.current.currentFov) * 5.0 * dt;
    const pCam = camera as THREE.PerspectiveCamera;
    if (pCam.isPerspectiveCamera) {
      pCam.fov = camState.current.currentFov;
    }
    camera.updateProjectionMatrix();

    // 4. Update Uniforms
    groundMaterial.uniforms.uCenter.value.set(msg.camX, msg.camY);
    groundMaterial.uniforms.uRadius.value = msg.fogRadiusWorld;
    groundMaterial.uniforms.uWorldWidth.value = mapW;
    groundMaterial.uniforms.uWorldHeight.value = mapH;

    snakeMat.uniforms.uTime.value = time;
    snakeMat.uniforms.uCenter.value.set(msg.camX, msg.camY);
    snakeMat.uniforms.uRadius.value = msg.fogRadiusWorld;
    snakeMat.uniforms.uMapWidth.value = mapW * gridSize;
    snakeMat.uniforms.uMapHeight.value = mapH * gridSize;

    shadowMat.uniforms.uCenter.value.set(msg.camX, msg.camY);
    shadowMat.uniforms.uRadius.value = msg.fogRadiusWorld;
    shadowMat.uniforms.uMapWidth.value = mapW * gridSize;
    shadowMat.uniforms.uMapHeight.value = mapH * gridSize;

    // Update Lensing refs
    progressRef.current = 1.0;
    lensingCamStateRef.current.camX = msg.camX;
    lensingCamStateRef.current.camY = msg.camY;

    // 5. Update instanced foods
    if (foodMeshRef.current && foodShadowMeshRef.current) {
      if (msg.foodCount > 0) {
        foodMeshRef.current.instanceMatrix.array.set(msg.foodMatrices);
        foodMeshRef.current.instanceMatrix.needsUpdate = true;
        if (!foodMeshRef.current.instanceColor) {
          foodMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(5000 * 3), 3);
        }
        foodMeshRef.current.instanceColor.array.set(msg.foodColors);
        foodMeshRef.current.instanceColor.needsUpdate = true;
        foodMeshRef.current.count = msg.foodCount;

        foodShadowMeshRef.current.instanceMatrix.array.set(msg.foodShadowMatrices);
        foodShadowMeshRef.current.instanceMatrix.needsUpdate = true;
        foodShadowMeshRef.current.count = msg.foodCount;
      } else {
        foodMeshRef.current.count = 0;
        foodShadowMeshRef.current.count = 0;
      }
    }

    // 6. Update instanced portals
    const timeSec = time / 1000.0;
    portalDiskMat.uniforms.uTime.value = timeSec;
    portalRingMat.uniforms.uTime.value = timeSec;
    blackHoleRingMat.uniforms.uTime.value = timeSec;
    blackHoleGravityMat.uniforms.uTime.value = timeSec;

    if (portalRingMeshRef.current && portalDiskMeshRef.current) {
      if (msg.portalCount > 0) {
        portalDiskMeshRef.current.instanceMatrix.array.set(msg.portalDiskMatrices);
        portalDiskMeshRef.current.instanceMatrix.needsUpdate = true;
        if (!portalDiskMeshRef.current.instanceColor) {
          portalDiskMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(100 * 3), 3);
        }
        portalDiskMeshRef.current.instanceColor.array.set(msg.portalDiskColors);
        portalDiskMeshRef.current.instanceColor.needsUpdate = true;
        portalDiskMeshRef.current.count = msg.portalCount;

        portalRingMeshRef.current.instanceMatrix.array.set(msg.portalRingMatrices);
        portalRingMeshRef.current.instanceMatrix.needsUpdate = true;
        if (!portalRingMeshRef.current.instanceColor) {
          portalRingMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(100 * 3), 3);
        }
        portalRingMeshRef.current.instanceColor.array.set(msg.portalRingColors);
        portalRingMeshRef.current.instanceColor.needsUpdate = true;
        portalRingMeshRef.current.count = msg.portalCount;
      } else {
        portalDiskMeshRef.current.count = 0;
        portalRingMeshRef.current.count = 0;
      }
    }

    // 7. Update instanced black holes
    if (blackHoleCoreMeshRef.current && blackHoleRingMeshRef.current && blackHoleGravityMeshRef.current) {
      if (msg.blackHoleCount > 0) {
        blackHoleCoreMeshRef.current.instanceMatrix.array.set(msg.blackHoleCoreMatrices);
        blackHoleCoreMeshRef.current.instanceMatrix.needsUpdate = true;
        blackHoleCoreMeshRef.current.count = msg.blackHoleCount;

        blackHoleRingMeshRef.current.instanceMatrix.array.set(msg.blackHoleRingMatrices);
        blackHoleRingMeshRef.current.instanceMatrix.needsUpdate = true;
        blackHoleRingMeshRef.current.count = msg.blackHoleCount;

        blackHoleGravityMeshRef.current.instanceMatrix.array.set(msg.blackHoleGravityMatrices);
        blackHoleGravityMeshRef.current.instanceMatrix.needsUpdate = true;
        blackHoleGravityMeshRef.current.count = msg.blackHoleCount;
      } else {
        blackHoleCoreMeshRef.current.count = 0;
        blackHoleRingMeshRef.current.count = 0;
        blackHoleGravityMeshRef.current.count = 0;
      }
    }

    // 8. Upload geometry attributes directly (zero memory copies / allocations)
    if (bodyGeometryRef.current && shadowGeometryRef.current) {
      const bodyGeom = bodyGeometryRef.current;
      const shadowGeom = shadowGeometryRef.current;

      if (msg.bodyVertices.length > 0) {
        updateDynamicAttribute(bodyGeom, 'position', msg.bodyVertices, 3);
        updateDynamicAttribute(bodyGeom, 'uv', msg.bodyUVs, 2);
        updateDynamicAttribute(bodyGeom, 'color', msg.bodyColors, 3);
        updateDynamicAttribute(bodyGeom, 'snakeParams', msg.bodySnakeParams, 2);
        updateDynamicIndex(bodyGeom, msg.bodyIndices);
        bodyGeom.setDrawRange(0, msg.bodyIndices.length);
      } else {
        bodyGeom.setDrawRange(0, 0);
      }

      if (msg.shadowVertices.length > 0) {
        updateDynamicAttribute(shadowGeom, 'position', msg.shadowVertices, 3);
        updateDynamicAttribute(shadowGeom, 'uv', msg.shadowUVs, 2);
        updateDynamicAttribute(shadowGeom, 'color', msg.shadowColors, 3);
        updateDynamicAttribute(shadowGeom, 'snakeParams', msg.shadowSnakeParams, 2);
        updateDynamicIndex(shadowGeom, msg.shadowIndices);
        shadowGeom.setDrawRange(0, msg.shadowIndices.length);
      } else {
        shadowGeom.setDrawRange(0, 0);
      }

      // 9. Update instanced eyes & pupils
      if (eyeMeshRef.current && pupilMeshRef.current) {
        if (msg.eyeCount > 0) {
          eyeMeshRef.current.instanceMatrix.array.set(msg.eyeMatrices);
          eyeMeshRef.current.instanceMatrix.needsUpdate = true;
          if (!eyeMeshRef.current.instanceColor) {
            eyeMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
          }
          eyeMeshRef.current.instanceColor.array.set(msg.eyeColors);
          eyeMeshRef.current.instanceColor.needsUpdate = true;
          eyeMeshRef.current.count = msg.eyeCount;

          pupilMeshRef.current.instanceMatrix.array.set(msg.pupilMatrices);
          pupilMeshRef.current.instanceMatrix.needsUpdate = true;
          if (!pupilMeshRef.current.instanceColor) {
            pupilMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
          }
          pupilMeshRef.current.instanceColor.array.set(msg.pupilColors);
          pupilMeshRef.current.instanceColor.needsUpdate = true;
          pupilMeshRef.current.count = msg.pupilCount;
        } else {
          eyeMeshRef.current.count = 0;
          pupilMeshRef.current.count = 0;
        }
      }

      // 10. Update text nickname labels
      if (activePlayerIds.length !== msg.activePlayers.length || JSON.stringify(activePlayerIds) !== JSON.stringify(msg.activePlayers)) {
        setActivePlayerIds(msg.activePlayers);
      }

      for (let i = 0; i < msg.nicknames.length; i++) {
        const n = msg.nicknames[i];
        const textEl = textRefs.current[n.id];
        if (textEl) {
          textEl.position.set(n.x, n.y, n.z);
          textEl.quaternion.copy(camera.quaternion);
          if (textEl.material) {
            textEl.material.opacity = n.opacity;
            textEl.material.transparent = true;
          }
        }
      }

      // 11. Update engine glow particles
      if (particleMeshRef.current) {
        if (msg.particleCount > 0) {
          particleMeshRef.current.instanceMatrix.array.set(msg.particleMatrices);
          particleMeshRef.current.instanceMatrix.needsUpdate = true;
          if (!particleMeshRef.current.instanceColor) {
            particleMeshRef.current.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
          }
          particleMeshRef.current.instanceColor.array.set(msg.particleColors);
          particleMeshRef.current.instanceColor.needsUpdate = true;
          particleMeshRef.current.count = msg.particleCount;
        } else {
          particleMeshRef.current.count = 0;
        }
      }
    }

    // 12. Update Diagnostics & HUD overlay in debug mode
    const debugVertices: number[] = [];
    const debugColors: number[] = [];

    const baseSpeedPerSecond = msg.gameState?.server_simulation?.base_speed_per_second ?? 6.0;

    if (debugMode && msg.gameState) {
      const state = msg.gameState;
      const debugHudEl = document.getElementById("debug-hud");
      if (debugHudEl) {
        if (myPlayer && myPlayer.body && myPlayer.body.length > 0) {
          const head = myPlayer.body[0];
          const hIdxX = Math.floor(head.x / 10);
          const hIdxY = Math.floor(head.y / 10);
          const headingDeg = ((myPlayer.angle * 180 / Math.PI) % 360).toFixed(1);
          const currentSpeed = (baseSpeedPerSecond * ((localInputRef.current.accelerating || myPlayer.accelerating) ? 2.0 : 1.0)).toFixed(1);
          let latencyText = document.getElementById("hud-ping")?.textContent || "offline";
          if (latencyText.startsWith("Ping: ")) {
            latencyText = latencyText.substring(6);
          }
          
          const growthFormula = state.server_snake?.growth_score_per_segment ?? 10.0;
          const nextSegCost = evaluateFormula(growthFormula, myPlayer.score, myPlayer.body.length).toFixed(1);

          debugHudEl.innerHTML = `
            <div style="font-weight: 800; border-bottom: 1px solid rgba(230, 57, 70, 0.4); padding-bottom: 4px; margin-bottom: 6px; color: #e63946; display: flex; align-items: center; gap: 4px;">
              <span>🐛</span> DEBUG PANELS
            </div>
            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 4px; font-family: monospace; font-size: 11px;">
              <span style="color: #a1a1aa;">My ID:</span> <span style="color: #fff; word-break: break-all;">${myIdRef.current.substring(0, 8)}...</span>
              <span style="color: #a1a1aa;">Coords:</span> <span style="color: #4ade80;">X:${head.x.toFixed(2)} Y:${head.y.toFixed(2)}</span>
              <span style="color: #a1a1aa;">Grid Cell:</span> <span style="color: #fbbf24;">[${hIdxX}, ${hIdxY}]</span>
              <span style="color: #a1a1aa;">Heading:</span> <span style="color: #60a5fa;">${headingDeg}° (${myPlayer.angle.toFixed(2)} rad)</span>
              <span style="color: #a1a1aa;">Turn:</span> <span style="color: #c084fc;">${localInputRef.current.turn?.toFixed(2) ?? '0.00'}</span>
              <span style="color: #a1a1aa;">Speed:</span> <span style="color: #f472b6;">${currentSpeed} cells/s</span>
              <span style="color: #a1a1aa;">Body Segs:</span> <span style="color: #38bdf8;">${myPlayer.body.length} segments</span>
              <span style="color: #a1a1aa;">Next Seg Cost:</span> <span style="color: #38bdf8;">${nextSegCost} score</span>
              <span style="color: #a1a1aa;">Score:</span> <span id="debug-score-val" data-score="${myPlayer.score}" style="color: #38bdf8; cursor: pointer; text-decoration: underline;" title="Click to edit">${myPlayer.score}</span>
              <span style="color: #a1a1aa;">Latency:</span> <span style="color: #a78bfa;">${latencyText}</span>
              <span style="color: #a1a1aa;">Active Plrs:</span> <span style="color: #10b981;">${Object.keys(state.players).length} connected</span>
              <span style="color: #a1a1aa;">Total Foods:</span> <span style="color: #ef4444;">${state.foods.length} items</span>
            </div>
          `;
        }
      }

      for (const playerId in state.players) {
        const p = state.players[playerId];
        if (!p.body || p.body.length === 0) continue;

        const isSelf = playerId === myIdRef.current;
        const currentLength = p.body.length;
        const effectiveLengthGained = Math.max(0, currentLength - startLength);
        const radius = (baseHeadRadius + effectiveLengthGained * 10.0 * scoreThicknessScale) * gridSize;

        const foundNickname = msg.nicknames.find((n: any) => n.id === playerId);
        const hx = foundNickname ? foundNickname.x : (p.body[0].x * gridSize + gridSize/2);
        const hy = foundNickname ? (foundNickname.y - (radius + 4.5)) : -(p.body[0].y * gridSize + gridSize/2);
        
        const zOffset = 3.0;

        const segments = 16;
        for (let j = 0; j < segments; j++) {
          const theta1 = (j / segments) * Math.PI * 2;
          const theta2 = ((j + 1) / segments) * Math.PI * 2;
          const x1 = hx + Math.cos(theta1) * radius;
          const y1 = hy + Math.sin(theta1) * radius;
          const x2 = hx + Math.cos(theta2) * radius;
          const y2 = hy + Math.sin(theta2) * radius;

          debugVertices.push(x1, y1, zOffset, x2, y2, zOffset);
          if (isSelf) {
            debugColors.push(0, 1, 0.5, 0, 1, 0.5);
          } else {
            debugColors.push(1, 0.3, 0.3, 1, 0.3, 0.3);
          }
        }

        const dirLength = radius * 2.0;
        const dx = hx + Math.cos(-p.angle) * dirLength;
        const dy = hy + Math.sin(-p.angle) * dirLength;
        debugVertices.push(hx, hy, zOffset, dx, dy, zOffset);
        debugColors.push(1, 0, 1, 1, 0, 1);
      }
    }

    if (debugGeometryRef.current) {
      if (debugVertices.length > 0) {
        updateDynamicAttribute(debugGeometryRef.current, 'position', debugVertices, 3);
        updateDynamicAttribute(debugGeometryRef.current, 'color', debugColors, 3);
        debugGeometryRef.current.setDrawRange(0, debugVertices.length / 3);
      } else {
        debugGeometryRef.current.setDrawRange(0, 0);
      }
    }
  });

  // Resource cleanup on unmount
  useEffect(() => {
    return () => {
      [
        foodMat, foodShadowMat, snakeMat, eyeMat, pupilMat, particleMat, groundMaterial,
        portalDiskMat, portalRingMat, blackHoleGravityMat, blackHoleRingMat, blackHoleCoreMat
      ].forEach(mat => mat.dispose());
      [planeGeo, flatCircleGeo, pupilGeo, particleGeo].forEach(geo => geo.dispose());
      if (bodyGeometryRef.current) bodyGeometryRef.current.dispose();
      if (shadowGeometryRef.current) shadowGeometryRef.current.dispose();
      if (debugGeometryRef.current) debugGeometryRef.current.dispose();
    };
  }, []);

  return (
    <>
      <Environment groundMeshRef={groundMeshRef} />

      <FoodsMesh foodMeshRef={foodMeshRef} foodShadowMeshRef={foodShadowMeshRef} />

      <SnakeGroup
        snakeMeshRef={snakeMeshRef}
        snakeShadowMeshRef={snakeShadowMeshRef}
        bodyGeometryRef={bodyGeometryRef}
        shadowGeometryRef={shadowGeometryRef}
        eyeMeshRef={eyeMeshRef}
        pupilMeshRef={pupilMeshRef}
        particleMeshRef={particleMeshRef}
        activePlayerIds={activePlayerIds}
        textRefs={textRefs}
      />
      
      <PortalsMesh portalDiskMeshRef={portalDiskMeshRef} portalRingMeshRef={portalRingMeshRef} />

      <BlackHolesMesh 
        blackHoleCoreMeshRef={blackHoleCoreMeshRef} 
        blackHoleRingMeshRef={blackHoleRingMeshRef} 
        blackHoleGravityMeshRef={blackHoleGravityMeshRef} 
      />

      <LensingEffect 
        gameStateRef={gameStateRef}
        lastGameStateRef={lastGameStateRef}
        progressRef={progressRef}
        gridSize={gridSize}
        camStateRef={lensingCamStateRef}
      />

      <DebugOverlay 
        debugMode={!!debugMode} 
        debugGridLines={debugGridLines} 
        debugGeometryRef={debugGeometryRef} 
      />
    </>
  );
};

export const GameRenderer = React.memo(({
  gameStateRef,
  lastGameStateRef,
  lastUpdateTimeRef,
  stateQueueRef,
  myIdRef,
  cameraModeRef,
  localInputRef,
  controlModeRef,
  socketRef,
  isMobile,
  minimapCanvasRef,
  debugMode,
  workerRef,
  latestFrameDataRef,
  isWaitingForFrameRef
}: {
  gameStateRef: React.MutableRefObject<GameState | null>;
  lastGameStateRef: React.MutableRefObject<GameState | null>;
  lastUpdateTimeRef: React.MutableRefObject<number>;
  stateQueueRef: React.MutableRefObject<{ time: number; state: GameState }[]>;
  myIdRef: React.MutableRefObject<string>;
  cameraModeRef: React.MutableRefObject<"2D" | "3D">;
  localInputRef: React.MutableRefObject<{ turn: number; accelerating: boolean; touchX?: number | null; tiltX?: number | null }>;
  controlModeRef: React.MutableRefObject<"keyboard" | "mouse" | "tilt">;
  socketRef: React.MutableRefObject<any>;
  isMobile?: boolean;
  minimapCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  debugMode?: boolean;
  workerRef: React.MutableRefObject<Worker | null>;
  latestFrameDataRef: React.MutableRefObject<any>;
  isWaitingForFrameRef: React.MutableRefObject<boolean>;
}) => {
  const localMinimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeMinimapCanvasRef = minimapCanvasRef || localMinimapCanvasRef;

  // Render Minimap Radar
  useEffect(() => {
    let animId: number;
    let lastDrawTime = 0;
    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      
      if (time - lastDrawTime < 66) return;
      lastDrawTime = time;
      
      const canvas = activeMinimapCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const state = gameStateRef.current;
      if (state && state.players && state.foods) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const mapW = state.server_world?.width ?? WORLD_WIDTH;
        const mapH = state.server_world?.height ?? WORLD_HEIGHT;
        const mapScaleX = canvas.width / mapW;
        const mapScaleY = canvas.height / mapH;

        for (let i = 0; i < state.foods.length; i++) {
          const f = state.foods[i];
          ctx.fillStyle = f.color || '#ef4444';
          ctx.globalAlpha = f.value >= 2 ? 0.8 : 0.5;
          const s = f.value >= 50 ? 5 : f.value >= 20 ? 4 : 2;
          ctx.fillRect(f.x * mapScaleX - s/2, f.y * mapScaleY - s/2, s, s);
        }
        ctx.globalAlpha = 1.0;

        const dotSize = 3.5;
        for (const pid in state.players) {
          if (pid === myIdRef.current) continue;
          const p = state.players[pid];
          if (p.body.length === 0) continue;
          ctx.fillStyle = p.skin === 'zebra' ? '#e2e8f0' : p.skin || '#22c55e';
          const head = p.body[0];
          ctx.beginPath();
          ctx.arc(head.x * mapScaleX, head.y * mapScaleY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }

        const myPlayer = state.players[myIdRef.current];
        if (myPlayer && myPlayer.body.length > 0) {
          ctx.fillStyle = '#ffffff';
          const head = myPlayer.body[0];
          ctx.beginPath();
          ctx.arc(head.x * mapScaleX, head.y * mapScaleY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [gameStateRef, myIdRef, activeMinimapCanvasRef]);

  return (
    <div style={{ 
      position: 'absolute', 
      top: isMobile ? 190 : 0, 
      left: 0, 
      width: '100%', 
      height: isMobile ? 'calc(100% - 190px - 90px)' : '100%', 
      backgroundColor: '#0c0c0f' 
    }}>
      <Canvas 
        shadows={false} 
        dpr={isMobile ? [1, 1.5] : [1, 2]} 
        camera={{ fov: 50, near: 15.0, far: 15000.0 }} 
        gl={{ logarithmicDepthBuffer: !isMobile }}
      >
        <GameScene 
          gameStateRef={gameStateRef}
          lastGameStateRef={lastGameStateRef}
          lastUpdateTimeRef={lastUpdateTimeRef}
          stateQueueRef={stateQueueRef}
          myIdRef={myIdRef}
          cameraModeRef={cameraModeRef}
          localInputRef={localInputRef}
          particlesRef={{ current: [] }} // dummy particles ref since worker manages particles now!
          controlModeRef={controlModeRef}
          socketRef={socketRef}
          isMobile={isMobile}
          debugMode={debugMode}
          workerRef={workerRef}
          latestFrameDataRef={latestFrameDataRef}
          isWaitingForFrameRef={isWaitingForFrameRef}
        />
      </Canvas>
      {!isMobile && (
        <div 
          className="hud-minimap-container"
          style={{ 
            position: 'absolute', 
            bottom: 20, 
            right: 20, 
            zIndex: 50, 
            pointerEvents: 'none',
            background: "rgba(20, 22, 28, 0.75)", 
            border: "1px solid rgba(255, 255, 255, 0.08)", 
            borderRadius: "16px", 
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(12px)",
            overflow: "hidden"
          }}
        >
          <canvas ref={activeMinimapCanvasRef} width={150} height={150} style={{ display: "block" }} />
        </div>
      )}
    </div>
  );
});

GameRenderer.displayName = "GameRenderer";
