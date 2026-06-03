import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { GameState } from '../types/game';

const DEFAULT_SERVER_TICK_RATE = 30;
const MAX_TURN_SPEED_DEG = 290.0;
const MIN_TURN_RADIUS = 0.5;
const TURN_RADIUS_THICKNESS_COEFF = 1.0;
const BASE_HEAD_RADIUS = 0.2;
const SCORE_THICKNESS_SCALE = 0.0005;
const CAMERA_ZOOM_OUT_COEFF = 0.002;
const MIN_FOG_RADIUS = 900.0;
const FOG_SCORE_EXPANSION_COEFF = 0.5;
const BASE_SPEED_PER_SECOND = 6.0;
const TURN_IDLE_SMOOTHING_AT_20HZ = 0.3;
const TURN_ACTIVE_SMOOTHING_AT_20HZ = 0.15;
const frameSmoothing = (smoothingAt20Hz: number, dt: number) =>
  1 - Math.pow(1 - smoothingAt20Hz, dt / 0.05);

const WORLD_WIDTH = 100;
const WORLD_HEIGHT = 100;
const gridSize = 20;
const WG = WORLD_WIDTH * gridSize;
const HG = WORLD_HEIGHT * gridSize;
const wrapOffsets: [number, number][] = [[0, 0], [WG, 0], [-WG, 0], [0, HG], [0, -HG]];

// Shared geometries and materials
const fogColor = new THREE.Color(12/255, 12/255, 15/255);
const flatCircleGeo = new THREE.CircleGeometry(1, 32);
const planeGeo = new THREE.PlaneGeometry(2, 2);
const pupilGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
pupilGeo.rotateX(Math.PI / 2); // Orient the hemisphere to point towards positive Z

const shadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  uniforms: {
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uFogColor: { value: fogColor },
    uMapWidth: { value: WORLD_WIDTH * gridSize },
    uMapHeight: { value: WORLD_HEIGHT * gridSize }
  },
  vertexShader: `
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    void main() {
      vUv = uv;
      vSnakeParams = snakeParams;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uMapWidth;
    uniform float uMapHeight;
    void main() {
      float r = vSnakeParams.x;
      float L = vSnakeParams.y;
      float x = (vUv.x - 0.5) * 2.0 * r;
      float y = vUv.y;
      
      float d_dist = 0.0;
      if (y < 0.0) {
        d_dist = length(vec2(x, y)) / r;
        if (d_dist > 1.0) discard;
      } else if (y > L) {
        d_dist = length(vec2(x, y - L)) / r;
        if (d_dist > 1.0) discard;
      } else {
        d_dist = abs(x) / r;
      }
      
      // Clip parts outside the map boundaries, except for the head when near the boundary
      bool isInsideMap = (vWorldPosition.x >= 0.0 && vWorldPosition.x <= uMapWidth &&
                          vWorldPosition.y <= 0.0 && vWorldPosition.y >= -uMapHeight);
      bool isHead = (y >= L - r * 1.5);
      bool isNearMap = (vWorldPosition.x >= -r * 2.0 && vWorldPosition.x <= uMapWidth + r * 2.0 &&
                        vWorldPosition.y <= r * 2.0 && vWorldPosition.y >= -uMapHeight - r * 2.0);
      if (!isInsideMap && !(isHead && isNearMap)) discard;
      
      float shadow = (1.0 - smoothstep(0.4, 1.0, d_dist)) * 0.45;
      if (shadow <= 0.01) discard;
      
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      float fogAmount = smoothstep(start, end, dist);
      
      gl_FragColor = vec4(vec3(0.0), shadow * (1.0 - fogAmount));
    }
  `
});

const snakeMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0.0 },
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uFogColor: { value: fogColor },
    uMapWidth: { value: WORLD_WIDTH * gridSize },
    uMapHeight: { value: WORLD_HEIGHT * gridSize }
  },
  vertexShader: `
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    void main() {
      vUv = uv;
      vColor = color;
      vSnakeParams = snakeParams;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    uniform float uTime;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec3 uFogColor;
    uniform float uMapWidth;
    uniform float uMapHeight;

    vec3 hslToRgb(float h, float s, float l) {
      float c = (1.0 - abs(2.0 * l - 1.0)) * s;
      float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
      float m = l - c * 0.5;
      vec3 rgb;
      if (h < 1.0 / 6.0) rgb = vec3(c, x, 0.0);
      else if (h < 2.0 / 6.0) rgb = vec3(x, c, 0.0);
      else if (h < 3.0 / 6.0) rgb = vec3(0.0, c, x);
      else if (h < 4.0 / 6.0) rgb = vec3(0.0, x, c);
      else if (h < 5.0 / 6.0) rgb = vec3(x, 0.0, c);
      else rgb = vec3(c, 0.0, x);
      return rgb + vec3(m);
    }

    void main() {
      float r = vSnakeParams.x;
      float L = vSnakeParams.y;
      float x = (vUv.x - 0.5) * 2.0 * r;
      float y = vUv.y;
      
      float d_dist = 0.0;
      if (y < 0.0) {
        d_dist = length(vec2(x, y)) / r;
        if (d_dist > 1.0) discard;
      } else if (y > L) {
        d_dist = length(vec2(x, y - L)) / r;
        if (d_dist > 1.0) discard;
      } else {
        d_dist = abs(x) / r;
      }
      
      // Clip parts outside the map boundaries, except for the head when near the boundary
      bool isInsideMap = (vWorldPosition.x >= 0.0 && vWorldPosition.x <= uMapWidth &&
                          vWorldPosition.y <= 0.0 && vWorldPosition.y >= -uMapHeight);
      bool isHead = (y >= L - r * 1.5);
      bool isNearMap = (vWorldPosition.x >= -r * 2.0 && vWorldPosition.x <= uMapWidth + r * 2.0 &&
                        vWorldPosition.y <= r * 2.0 && vWorldPosition.y >= -uMapHeight - r * 2.0);
      if (!isInsideMap && !(isHead && isNearMap)) discard;
      
      float skinType = vColor.r;
      vec3 baseColor;
      
      if (skinType > 1.5) {
        float sCoord = vUv.y;
        
        if (skinType < 2.5) {
          // Zebra (25px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
          baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.9, 0.9, 0.9), f);
        } else if (skinType < 3.5) {
          // Tiger (35px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 35.0) * 3.14159);
          baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.97, 0.45, 0.09), f);
        } else if (skinType < 4.5) {
          // Cyberpunk (25px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
          baseColor = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), f);
        } else {
          // Rainbow (repeats every 720px)
          float h = mod(sCoord * 0.5 - uTime / 20.0, 360.0);
          baseColor = hslToRgb(h / 360.0, 1.0, 0.5);
        }
      } else {
        baseColor = vColor;
      }
      
      // Flat premium contour edge outline
      float edge = smoothstep(0.85, 0.98, d_dist);
      vec3 finalColor = mix(baseColor, baseColor * 0.8, edge);
      
      // Apply GPU-based fog
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      float fogAmount = smoothstep(start, end, dist);
      vec3 finalColorWithFog = mix(finalColor, uFogColor, fogAmount);
      
      gl_FragColor = vec4(finalColorWithFog, 1.0);
    }
  `
});
const foodShadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      float d = length(vUv - vec2(0.5)) * 2.0;
      // Beautiful Gaussian soft shadow profile for levitating food
      float shadow = exp(-d * d * 4.5) * 0.65;
      if (shadow <= 0.01) discard;
      gl_FragColor = vec4(0.0, 0.0, 0.0, shadow);
    }
  `
});
const foodMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexColors: true,
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      vColor = instanceColor;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      float d = length(vUv - vec2(0.5)) * 2.0;
      float body = 1.0 - smoothstep(0.58, 0.62, d);
      float glow = (1.0 - smoothstep(0.6, 1.0, d)) * 0.6;
      
      if (body <= 0.01 && glow <= 0.01) discard;
      
      vec3 glowColor = vColor * 0.7;
      vec3 finalColor = mix(glowColor, vColor, body);
      float finalAlpha = max(body, glow);
      
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
});
const particleGeo = new THREE.PlaneGeometry(1, 1);
const particleMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const eyeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const pupilMat = new THREE.MeshStandardMaterial({
  color: 0x000000,
  roughness: 0.05,
  metalness: 0.1
});

const groundMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uFogColor: { value: fogColor },
    uGroundColor: { value: new THREE.Color(0xfafafa) },
    uGridColor: { value: new THREE.Color(0xe5e5e5) },
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uGridSize: { value: 20.0 },
    uWorldWidth: { value: WORLD_WIDTH },
    uWorldHeight: { value: WORLD_HEIGHT },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uFogColor;
    uniform vec3 uGroundColor;
    uniform vec3 uGridColor;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uGridSize;
    uniform float uWorldWidth;
    uniform float uWorldHeight;
    varying vec3 vWorldPosition;
    
    void main() {
      float gridX = step(0.95, fract(vWorldPosition.x / (uGridSize * 2.0)));
      float gridY = step(0.95, fract(vWorldPosition.y / (uGridSize * 2.0)));
      float isGrid = max(gridX, gridY);
      
      float isOut = 0.0;
      if (vWorldPosition.x < 0.0 || vWorldPosition.x > uWorldWidth * uGridSize ||
          vWorldPosition.y > 0.0 || vWorldPosition.y < -uWorldHeight * uGridSize) {
          isOut = 1.0;
      }
                    
      vec3 finalColor = mix(uGroundColor, uGridColor, isGrid);
      if (isOut > 0.0) finalColor = vec3(0.0);
      
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      
      float fogAmount = smoothstep(start, end, dist);
      gl_FragColor = vec4(mix(finalColor, uFogColor, fogAmount), 1.0);
    }
  `,
});

const hslToHex = (h: number, s: number, l: number) => {
  h = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return (Math.round(f(0) * 255) << 16) + (Math.round(f(8) * 255) << 8) + Math.round(f(4) * 255);
};

const lerpColors = (c1: string, c2: string, f: number) => {
  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);

  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);

  return (r << 16) + (g << 8) + b;
};

const colorCache = new Map<string, number>();
const parseColor = (colorStr: string) => {
  if (!colorStr) return 0x22c55e;
  const cached = colorCache.get(colorStr);
  if (cached !== undefined) return cached;
  const parsed = parseInt(colorStr.replace('#', '0x'), 16) || 0x22c55e;
  colorCache.set(colorStr, parsed);
  return parsed;
};

type SmoothPoint = { x: number; y: number; coord: number };
const smoothPointsPool: SmoothPoint[] = [];
let smoothPointsPoolSize = 0;

function resetSmoothPointsPool() {
  smoothPointsPoolSize = 0;
}

function pushSmoothPoint(x: number, y: number, coord: number) {
  if (smoothPointsPoolSize >= smoothPointsPool.length) {
    smoothPointsPool.push({ x, y, coord });
  } else {
    const pt = smoothPointsPool[smoothPointsPoolSize];
    pt.x = x;
    pt.y = y;
    pt.coord = coord;
  }
  smoothPointsPoolSize++;
}

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
}

function updateDynamicAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
  data: number[],
  itemSize: number
) {
  let attr = geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
  const requiredLength = data.length;
  
  if (!attr || attr.array.length < requiredLength) {
    const newSize = Math.max(Math.ceil(requiredLength * 1.3), 512); // Extra capacity padding
    const newArray = new Float32Array(newSize);
    newArray.set(data);
    attr = new THREE.BufferAttribute(newArray, itemSize);
    attr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attr);
  } else {
    const array = attr.array as Float32Array;
    // Fast, zero-allocation array copy in-place
    array.set(data);
    attr.needsUpdate = true;
  }
}

function updateDynamicIndex(
  geometry: THREE.BufferGeometry,
  indices: number[]
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
  isMobile
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
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);
  
  const textRefs = useRef<Record<string, any>>({});
  const [activePlayerIds, setActivePlayerIds] = useState<{id: string, isMe: boolean, nickname: string}[]>([]);
  const renderTimeRef = useRef<number | null>(null);
  const cachedFoodMapRef = useRef(new Map<number, { x: number; y: number }>());
  const lastSentTurnRef = useRef<number>(0);
  const lastSentTimeRef = useRef<number>(0);

  const bodyVerticesRef = useRef<number[]>([]);
  const bodyUVsRef = useRef<number[]>([]);
  const bodyColorsRef = useRef<number[]>([]);
  const bodySnakeParamsRef = useRef<number[]>([]);
  const bodyIndicesRef = useRef<number[]>([]);

  const shadowVerticesRef = useRef<number[]>([]);
  const shadowUVsRef = useRef<number[]>([]);
  const shadowColorsRef = useRef<number[]>([]);
  const shadowSnakeParamsRef = useRef<number[]>([]);
  const shadowIndicesRef = useRef<number[]>([]);

  // Camera transition state
  const camState = useRef({
    transition: cameraModeRef.current === '3D' ? 1.0 : 0.0,
    currentZoomOffset: 0,
    localAngle: null as number | null,
    localCurrentTurn: 0,
    lastFrameTime: performance.now(),
    lastPlayerSyncTime: 0,
    lastDeathCheckTime: 0,
    currentFov: 50.0,
  });

  useFrame((r3fState) => {
    const time = performance.now();
    let dt = (time - camState.current.lastFrameTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    camState.current.lastFrameTime = time;

    const queue = stateQueueRef.current;
    const serverSimulation = gameStateRef.current?.server_simulation;
    const serverTickRate = serverSimulation?.tick_rate || gameStateRef.current?.server_tick_rate || DEFAULT_SERVER_TICK_RATE;
    const serverTickMs = 1000 / serverTickRate;

    let state: GameState | null = null;
    let lastState: GameState | null = null;
    let progress = 1.0;

    if (queue.length >= 2) {
      const targetDelay = 3.0 * serverTickMs;
      if (renderTimeRef.current === null) {
        renderTimeRef.current = queue[queue.length - 1].time - targetDelay;
      }

      const newestTime = queue[queue.length - 1].time;
      const oldestTime = queue[0].time;

      const currentDelay = newestTime - renderTimeRef.current;
      const error = currentDelay - targetDelay;
      let playbackSpeed = 1.0 + error * 0.005;
      playbackSpeed = Math.max(0.5, Math.min(1.5, playbackSpeed));

      if (renderTimeRef.current < oldestTime) {
        renderTimeRef.current = oldestTime;
      }
      if (renderTimeRef.current > newestTime) {
        renderTimeRef.current = newestTime;
        playbackSpeed = 0.0;
      }

      renderTimeRef.current += dt * 1000 * playbackSpeed;

      let indexA = 0;
      for (let i = 0; i < queue.length - 1; i++) {
        if (queue[i].time <= renderTimeRef.current && renderTimeRef.current <= queue[i + 1].time) {
          indexA = i;
          break;
        }
        if (queue[i + 1].time > renderTimeRef.current) {
          indexA = i;
          break;
        }
      }

      const stateA = queue[indexA].state;
      const stateB = queue[indexA + 1].state;
      const timeA = queue[indexA].time;
      const timeB = queue[indexA + 1].time;

      lastState = stateA;
      state = stateB;

      const denom = timeB - timeA;
      progress = denom > 0.001 ? Math.max(0.0, Math.min(1.0, (renderTimeRef.current - timeA) / denom)) : 1.0;
    } else {
      state = gameStateRef.current;
      lastState = lastGameStateRef.current;
      progress = lastUpdateTimeRef.current === 0 ? 1 : Math.min((time - lastUpdateTimeRef.current) / serverTickMs, 2.0);
    }

    if (!state) return;
    const mapW = state.server_world?.width ?? WORLD_WIDTH;
    const mapH = state.server_world?.height ?? WORLD_HEIGHT;

    // Update ground mesh scale and position dynamically
    if (groundMeshRef.current) {
      groundMeshRef.current.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
      groundMeshRef.current.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);
    }

    const myId = myIdRef.current;
    const myPlayer = state.players[myId];

    let camX = (mapW * gridSize) / 2;
    let camY = -(mapH * gridSize) / 2;

    if (myPlayer && myPlayer.body && myPlayer.body.length > 0) {
      const target = myPlayer.body[0];
      let start = target;
      const oldBody = lastState?.players[myId]?.body;
      if (oldBody && oldBody.length > 0) start = oldBody[0];
      if (Math.abs(target.x - start.x) > mapW / 2 || Math.abs(target.y - start.y) > mapH / 2) start = target;

      camX = (start.x + (target.x - start.x) * progress) * gridSize + gridSize / 2;
      camY = -((start.y + (target.y - start.y) * progress) * gridSize + gridSize / 2);
    }

    if ((controlModeRef.current === "mouse" || controlModeRef.current === "tilt") && myPlayer) {
      const sensitivity = state.server_visual?.mouse_sensitivity ?? 1.0;
      const targetDeflection = 0.5 * sensitivity;

      let pointerX = 0;
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

      let desiredTurnFactor = 0;
      // Small deadzone of 0.02 (1% of screen half-width) to easily go perfectly straight
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

      // Instantly update client-side prediction turn factor for 60FPS fluid locally predicted response
      localInputRef.current.turn = desiredTurnFactor;
    }

    // Update active players list for React rendering (throttled to 2Hz to prevent GC spikes and re-renders)
    // We only render nicknames for the closest players (3 on mobile, 8 on desktop) to prevent WebGL Text unmount/mount lags.
    if (time - camState.current.lastPlayerSyncTime > 500) {
      camState.current.lastPlayerSyncTime = time;
      
      const allPlayers = Object.entries(state.players);
      const sortedPlayers = allPlayers
        .map(([id, p]) => {
          if (!p.body || p.body.length === 0) return { id, isMe: id === myId, nickname: p.nickname || "Игрок", distSq: Infinity };
          const h = p.body[0];
          const wx = h.x * gridSize + gridSize/2;
          const wy = -(h.y * gridSize + gridSize/2);
          const distSq = (wx - camX)**2 + (wy - camY)**2;
          return { id, isMe: id === myId, nickname: p.nickname || "Игрок", distSq };
        })
        .sort((a, b) => {
          if (a.isMe) return -1;
          if (b.isMe) return 1;
          return a.distSq - b.distSq;
        });

      const limit = isMobile ? 4 : 9; // 1 (self) + 3/8 remote players
      const closestIds = sortedPlayers.slice(0, limit);
      
      const hasChanged = closestIds.length !== activePlayerIds.length || 
                         !closestIds.every((item, idx) => activePlayerIds[idx] && activePlayerIds[idx].id === item.id);
      
      if (hasChanged) {
        setActivePlayerIds(closestIds.map(item => ({ id: item.id, isMe: item.isMe, nickname: item.nickname })));
      }
    }
    const maxTurnSpeedDeg = serverSimulation?.max_turn_speed_deg_per_second ?? MAX_TURN_SPEED_DEG;
    const minTurnRadius = serverSimulation?.min_turn_radius ?? MIN_TURN_RADIUS;
    const turnRadiusThicknessCoeff = serverSimulation?.turn_radius_thickness_coeff ?? TURN_RADIUS_THICKNESS_COEFF;
    const baseSpeedPerSecond = serverSimulation?.base_speed_per_second ?? BASE_SPEED_PER_SECOND;
    const baseHeadRadius = state.server_snake?.base_head_radius ?? BASE_HEAD_RADIUS;
    const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? SCORE_THICKNESS_SCALE;
    const cameraZoomOutCoeff = state.server_snake?.camera_zoom_out_coeff ?? CAMERA_ZOOM_OUT_COEFF;
    
    const visual = state.server_visual;
    const minFogRadius = visual?.min_fog_radius ?? MIN_FOG_RADIUS;
    const fogExpansionCoeff = visual?.fog_score_expansion_coeff ?? FOG_SCORE_EXPANSION_COEFF;
    const fogRadiusWorld = minFogRadius + (myPlayer?.score || 0) * fogExpansionCoeff;
    const cameraBaseZoom = visual?.camera_base_zoom ?? 1.0;
    const cameraPitchAngle = visual?.camera_pitch_angle ?? 55.0;
    const cameraZHeightOffset = visual?.camera_z_height ?? 0.0;
    const cameraYOffset = visual?.camera_y_offset ?? 0.25;

    const targetTransition = cameraModeRef.current === '3D' ? 1.0 : 0.0;
    camState.current.transition += (targetTransition - camState.current.transition) * dt * 6.0;
    if (Math.abs(targetTransition - camState.current.transition) < 0.005) camState.current.transition = targetTransition;
    const cameraTransition = camState.current.transition;
    let camAngle = 0;

    if (myPlayer) {
      if (camState.current.localAngle === null) {
        camState.current.localAngle = myPlayer.angle;
      }
      
      const myHeadRadius = baseHeadRadius + (myPlayer.score || 0) * scoreThicknessScale;
      const effectiveRadius = minTurnRadius + myHeadRadius * turnRadiusThicknessCoeff;
      const maxTurnFromRadius = baseSpeedPerSecond / Math.max(effectiveRadius, 0.01);
      const turnPerTick = Math.min(maxTurnSpeedDeg * Math.PI / 180, maxTurnFromRadius) / serverTickRate;

      const targetTurn = localInputRef.current.turn * turnPerTick;
      if (controlModeRef.current === "mouse" || controlModeRef.current === "tilt") {
        camState.current.localCurrentTurn = targetTurn; // Instant response in mouse & tilt modes!
      } else {
        const smoothing = localInputRef.current.turn === 0 ? (serverSimulation?.turn_idle_smoothing_at_20hz ?? TURN_IDLE_SMOOTHING_AT_20HZ) : (serverSimulation?.turn_active_smoothing_at_20hz ?? TURN_ACTIVE_SMOOTHING_AT_20HZ);
        camState.current.localCurrentTurn += (targetTurn - camState.current.localCurrentTurn) * frameSmoothing(smoothing, dt);
      }
      camState.current.localAngle += camState.current.localCurrentTurn * dt * serverTickRate;

      const angleDiff = Math.atan2(Math.sin(myPlayer.angle - camState.current.localAngle), Math.cos(myPlayer.angle - camState.current.localAngle));
      if (Math.abs(angleDiff) > Math.PI / 2) {
        camState.current.localAngle = myPlayer.angle;
      } else {
        camState.current.localAngle += angleDiff * 0.1;
      }

      if (myPlayer.accelerating || localInputRef.current.accelerating) {
        camState.current.currentZoomOffset = Math.min(1, camState.current.currentZoomOffset + 3.0 * dt);
      } else {
        camState.current.currentZoomOffset = Math.max(0, camState.current.currentZoomOffset - 3.0 * dt);
      }

      const target = myPlayer.body[0];
      let start = target;
      const oldBody = lastState?.players[myId]?.body;
      if (oldBody && oldBody.length > 0) start = oldBody[0];
      if (Math.abs(target.x - start.x) > mapW / 2 || Math.abs(target.y - start.y) > mapH / 2) start = target;

      camX = (start.x + (target.x - start.x) * progress) * gridSize + gridSize / 2;
      camY = -((start.y + (target.y - start.y) * progress) * gridSize + gridSize / 2);
      camAngle = camState.current.localAngle;
    }

    // UPDATE CAMERA
    const zoom2D = 1.0 - camState.current.currentZoomOffset * 0.05;
    const scoreZoomFactor = 1.0 / (1.0 + (myPlayer?.score || 0) * cameraZoomOutCoeff);
    const globalScale = (zoom2D + (1 - zoom2D) * cameraTransition) * scoreZoomFactor * cameraBaseZoom;
    
    // In three.js FOV affects visual scale. Let's fix FOV to 50 and use height to zoom.
    const distance = (1500 / globalScale) + cameraZHeightOffset; 
    const pitch = (cameraPitchAngle * Math.PI / 180) * cameraTransition;
    
    const trueCamAngle = -camAngle;
    
    // Orbit camera backwards based on pitch to keep the snake in the center of view
    const dirB_x = -Math.cos(trueCamAngle);
    const dirB_y = -Math.sin(trueCamAngle);
    
    const orbitCamX = camX + dirB_x * distance * Math.sin(pitch);
    const orbitCamY = camY + dirB_y * distance * Math.sin(pitch);
    const orbitCamZ = distance * Math.cos(pitch);

    // Offset camera forwards along the ground to shift snake lower on the screen
    const offsetDistance = 1000 * cameraYOffset * cameraTransition / globalScale;
    const finalCamX = orbitCamX + Math.cos(trueCamAngle) * offsetDistance;
    const finalCamY = orbitCamY + Math.sin(trueCamAngle) * offsetDistance;

    camera.position.set(finalCamX, finalCamY, orbitCamZ);
    camera.rotation.order = 'ZYX';
    camera.rotation.set(0, 0, trueCamAngle - Math.PI / 2);
    camera.rotateX(pitch);
    
    // FOV ACCELERATION EFFECT
    const targetFov = myPlayer?.accelerating ? 70.0 : 50.0;
    camState.current.currentFov += (targetFov - camState.current.currentFov) * 5.0 * dt;
    const pCam = camera as THREE.PerspectiveCamera;
    if (pCam.isPerspectiveCamera) {
      pCam.fov = camState.current.currentFov;
    }
    camera.updateProjectionMatrix();

    // UPDATE GROUND FOG SHADER
    groundMaterial.uniforms.uCenter.value.set(camX, camY);
    groundMaterial.uniforms.uRadius.value = fogRadiusWorld;
    groundMaterial.uniforms.uWorldWidth.value = mapW;
    groundMaterial.uniforms.uWorldHeight.value = mapH;

    // UPDATE SNAKE & SHADOW UNIFORMS
    snakeMat.uniforms.uTime.value = time;
    snakeMat.uniforms.uCenter.value.set(camX, camY);
    snakeMat.uniforms.uRadius.value = fogRadiusWorld;
    snakeMat.uniforms.uMapWidth.value = mapW * gridSize;
    snakeMat.uniforms.uMapHeight.value = mapH * gridSize;

    shadowMat.uniforms.uCenter.value.set(camX, camY);
    shadowMat.uniforms.uRadius.value = fogRadiusWorld;
    shadowMat.uniforms.uMapWidth.value = mapW * gridSize;
    shadowMat.uniforms.uMapHeight.value = mapH * gridSize;

    const calcFogAmount = (wx: number, wy: number) => {
      const dist = Math.sqrt((wx - camX)**2 + (wy - camY)**2);
      const start = fogRadiusWorld * 0.75;
      const end = fogRadiusWorld * 0.95;
      if (dist >= end) return 1.0;
      if (dist <= start) return 0.0;
      return (dist - start) / (end - start);
    };

    // UPDATE FOODS
    const foods = state.foods || [];
    if (foodMeshRef.current && foodShadowMeshRef.current) {
      let count = 0;
      const baseRadius = state.server_food?.base_radius ?? 0.2;
      const radiusValueScale = state.server_food?.radius_value_scale ?? 0.1;
      
      const lastFoodMap = cachedFoodMapRef.current;
      lastFoodMap.clear();
      if (lastState && lastState.foods) {
        for (let i = 0; i < lastState.foods.length; i++) {
          const lf = lastState.foods[i];
          lastFoodMap.set(lf.id, lf);
        }
      }

      for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        
        let fx = food.x;
        let fy = food.y;
        
        const lf = lastFoodMap.get(food.id);
        if (lf) {
          let dx = food.x - lf.x;
          let dy = food.y - lf.y;
          if (Math.abs(dx) > mapW / 2) {
            fx = food.x;
          } else {
            fx = lf.x + dx * progress;
          }
          if (Math.abs(dy) > mapH / 2) {
            fy = food.y;
          } else {
            fy = lf.y + dy * progress;
          }
        }

        const foodRadius = (baseRadius + Math.sqrt(food.value) * radiusValueScale) * gridSize;
        const wx = fx * gridSize + gridSize/2;
        const wy = -(fy * gridSize + gridSize/2);
        
        // Instanced Food Viewport Culling (Item 4)
        const distToCamSq = (wx - camX)**2 + (wy - camY)**2;
        if (distToCamSq > (fogRadiusWorld * 1.05) ** 2) {
          continue;
        }
        
        colorObj.set(parseColor(food.color || '#ef4444'));
        const fogAmt = calcFogAmount(wx, wy);
        if (fogAmt > 0) colorObj.lerp(fogColor, fogAmt);

        // 1. Food Shadow flat on shadow plane at Z = 0.2
        // We place the shadow exactly at (wx, wy) without any manual offset to keep it natural in 2D mode,
        // while letting the camera tilt perspective project the natural 3D parallax shift perfectly.
        dummy.position.set(wx, wy, 0.2);
        dummy.scale.setScalar(foodRadius * 2.4); // Beautifully soft, realistic, slightly wider shadow
        dummy.rotation.set(0, 0, 0); // Ensure it lies flat in the XY plane (parallel to the ground)
        dummy.updateMatrix();
        foodShadowMeshRef.current.setMatrixAt(count, dummy.matrix);

        // 2. Food Body levitating slightly above shadow at Z = 1.5
        // This height creates a beautiful, subtle 3D parallax shift when viewed from camera angles.
        dummy.position.set(wx, wy, 1.5);
        dummy.scale.setScalar(foodRadius * 1.666);
        dummy.rotation.set(0, 0, 0); // Keep it completely flat in the XY plane (parallel to ground)
        dummy.updateMatrix();
        foodMeshRef.current.setMatrixAt(count, dummy.matrix);
        foodMeshRef.current.setColorAt(count, colorObj);
        
        count++;
      }
      foodMeshRef.current.count = count;
      foodMeshRef.current.instanceMatrix.needsUpdate = true;
      if (foodMeshRef.current.instanceColor) foodMeshRef.current.instanceColor.needsUpdate = true;

      foodShadowMeshRef.current.count = count;
      foodShadowMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    // UPDATE SNAKES
    if (bodyGeometryRef.current && shadowGeometryRef.current) {
      const bodyGeom = bodyGeometryRef.current;
      const shadowGeom = shadowGeometryRef.current;

      const bodyVertices = bodyVerticesRef.current;
      const bodyUVs = bodyUVsRef.current;
      const bodyColors = bodyColorsRef.current;
      const bodySnakeParams = bodySnakeParamsRef.current;
      const bodyIndices = bodyIndicesRef.current;

      const shadowVertices = shadowVerticesRef.current;
      const shadowUVs = shadowUVsRef.current;
      const shadowColors = shadowColorsRef.current;
      const shadowSnakeParams = shadowSnakeParamsRef.current;
      const shadowIndices = shadowIndicesRef.current;

      bodyVertices.length = 0;
      bodyUVs.length = 0;
      bodyColors.length = 0;
      bodySnakeParams.length = 0;
      bodyIndices.length = 0;

      shadowVertices.length = 0;
      shadowUVs.length = 0;
      shadowColors.length = 0;
      shadowSnakeParams.length = 0;
      shadowIndices.length = 0;

      let globalVertexCount = 0;
      let shadowVertexCount = 0;

      for (const playerId in state.players) {
        const p = state.players[playerId];
        if (!p.body || p.body.length === 0) continue;

        // Spline Bounding Box Culling (Item 6)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < p.body.length; i++) {
          const pt = p.body[i];
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        const bMinX = minX * gridSize;
        const bMaxX = maxX * gridSize + gridSize;
        const bMinY = -(maxY * gridSize + gridSize);
        const bMaxY = -minY * gridSize;
        
        const closestX = Math.max(bMinX, Math.min(camX, bMaxX));
        const closestY = Math.max(bMinY, Math.min(camY, bMaxY));
        const distSq = (closestX - camX)**2 + (closestY - camY)**2;
        if (distSq > (fogRadiusWorld * 1.05) ** 2) {
          continue;
        }

        const oldP = lastState?.players[playerId];
        const score = p.score || 0;
        const snakeRadius = (baseHeadRadius + score * scoreThicknessScale) * gridSize;
        const skin = p.skin || '#22c55e';

        const logicalX: number[] = [];
        const logicalY: number[] = [];
        for (let i = 0; i < p.body.length; i++) {
          const target = p.body[i];
          let start = target;
          if (oldP && oldP.body) {
            start = oldP.body[i] || oldP.body[oldP.body.length - 1] || target;
          }
          if (Math.abs(target.x - start.x) > 50 || Math.abs(target.y - start.y) > 50) start = target;
          logicalX.push(start.x + (target.x - start.x) * progress);
          logicalY.push(start.y + (target.y - start.y) * progress);
        }

        const uwLX = [logicalX[0]];
        const uwLY = [logicalY[0]];
        for (let i = 1; i < logicalX.length; i++) {
          let dx = logicalX[i] - uwLX[i - 1];
          let dy = logicalY[i] - uwLY[i - 1];
          if (dx > mapW / 2) dx -= mapW;
          else if (dx < -mapW / 2) dx += mapW;
          if (dy > mapH / 2) dy -= mapH;
          else if (dy < -mapH / 2) dy += mapH;
          uwLX.push(uwLX[i - 1] + dx);
          uwLY.push(uwLY[i - 1] + dy);
        }

        const bodyLength = p.body.length;
        const density = bodyLength > 40 ? 1 : 2;

        resetSmoothPointsPool();

        // Build continuous path points (from tail to head)
        for (let i = uwLX.length - 1; i >= 0; i--) {
          const steps = i === uwLX.length - 1 ? 1 : density;
          for (let k = steps - 1; k >= 0; k--) {
            const t = k / density;
            
            let sx = uwLX[i];
            let sy = uwLY[i];
            if (i < uwLX.length - 1) {
              sx = uwLX[i] + (uwLX[i+1] - uwLX[i]) * t;
              sy = uwLY[i] + (uwLY[i+1] - uwLY[i]) * t;
            }
            
            const wx = sx * gridSize + gridSize/2;
            const wy = -(sy * gridSize + gridSize/2);
            pushSmoothPoint(wx, wy, i + t);
          }
        }

        const smoothPoints = smoothPointsPool;
        const numPoints = smoothPointsPoolSize;
        if (numPoints < 2) continue;

        // Calculate cumulative physical arc length (in pixels) for stable, uniform texturing
        const distances: number[] = [0];
        for (let j = 1; j < numPoints; j++) {
          const dx = smoothPoints[j].x - smoothPoints[j - 1].x;
          const dy = smoothPoints[j].y - smoothPoints[j - 1].y;
          const segmentDist = Math.sqrt(dx * dx + dy * dy);
          distances.push(distances[j - 1] + segmentDist);
        }

        // Calculate raw normals at each point along the snake
        const rawNormalsX: number[] = [];
        const rawNormalsY: number[] = [];
        for (let j = 0; j < numPoints; j++) {
          let dx = 0;
          let dy = 0;
          if (j === 0) {
            dx = smoothPoints[1].x - smoothPoints[0].x;
            dy = smoothPoints[1].y - smoothPoints[0].y;
          } else if (j === numPoints - 1) {
            dx = smoothPoints[numPoints - 1].x - smoothPoints[numPoints - 2].x;
            dy = smoothPoints[numPoints - 1].y - smoothPoints[numPoints - 2].y;
          } else {
            dx = smoothPoints[j + 1].x - smoothPoints[j - 1].x;
            dy = smoothPoints[j + 1].y - smoothPoints[j - 1].y;
          }
          let len = Math.sqrt(dx * dx + dy * dy);
          if (len < 0.001) {
            rawNormalsX.push(j > 0 ? rawNormalsX[j - 1] : 1);
            rawNormalsY.push(j > 0 ? rawNormalsY[j - 1] : 0);
          } else {
            rawNormalsX.push(-dy / len);
            rawNormalsY.push(dx / len);
          }
        }

        // Apply dynamic box filter to smooth the normals
        const nx: number[] = [];
        const ny: number[] = [];
        if (density === 1) {
          // Bypass filtering entirely for long snakes to save performance
          for (let j = 0; j < numPoints; j++) {
            nx.push(rawNormalsX[j]);
            ny.push(rawNormalsY[j]);
          }
        } else {
          const filterSize = density === 2 ? 1 : 2; // 3-tap for density 2, 5-tap for density 4
          for (let j = 0; j < numPoints; j++) {
            let sumX = 0;
            let sumY = 0;
            for (let w = -filterSize; w <= filterSize; w++) {
              const idx = j + w;
              if (idx >= 0 && idx < numPoints) {
                sumX += rawNormalsX[idx];
                sumY += rawNormalsY[idx];
              }
            }
            let len = Math.sqrt(sumX * sumX + sumY * sumY);
            if (len < 0.001) {
              nx.push(rawNormalsX[j]);
              ny.push(rawNormalsY[j]);
            } else {
              nx.push(sumX / len);
              ny.push(sumY / len);
            }
          }
        }

        // Parse skin encoding color
        let skinR = 0;
        let skinG = 0;
        let skinB = 0;

        if (skin === 'zebra') {
          skinR = 2.0;
        } else if (skin === 'tiger') {
          skinR = 3.0;
        } else if (skin === 'cyberpunk') {
          skinR = 4.0;
        } else if (skin === 'rainbow') {
          skinR = 5.0;
        } else {
          const c = parseColor(skin);
          skinR = ((c >> 16) & 255) / 255;
          skinG = ((c >> 8) & 255) / 255;
          skinB = (c & 255) / 255;
        }

        // Calculate segment directions for cap extensions
        // 1. Tail direction (from smoothPoints[1] to smoothPoints[0])
        const dxTail = smoothPoints[0].x - smoothPoints[1].x;
        const dyTail = smoothPoints[0].y - smoothPoints[1].y;
        const lenTail = Math.sqrt(dxTail * dxTail + dyTail * dyTail);
        let dirTailX = 0;
        let dirTailY = 0;
        if (lenTail > 0.001) {
          dirTailX = dxTail / lenTail;
          dirTailY = dyTail / lenTail;
        } else {
          dirTailX = -ny[0];
          dirTailY = nx[0];
        }

        // 2. Head direction (from smoothPoints[N-2] to smoothPoints[N-1])
        const dxHead = smoothPoints[numPoints - 1].x - smoothPoints[numPoints - 2].x;
        const dyHead = smoothPoints[numPoints - 1].y - smoothPoints[numPoints - 2].y;
        const lenHead = Math.sqrt(dxHead * dxHead + dyHead * dyHead);
        let dirHeadX = 0;
        let dirHeadY = 0;
        if (lenHead > 0.001) {
          dirHeadX = dxHead / lenHead;
          dirHeadY = dyHead / lenHead;
        } else {
          dirHeadX = ny[numPoints - 1];
          dirHeadY = -nx[numPoints - 1];
        }

        // Make the snake shadow spread (margin) a static offset in world space (e.g. 3.2 units) 
        // to keep it independent of the snake's scale as requested by the user.
        const shadowRadius = snakeRadius + 3.2;

        const currentWG = mapW * gridSize;
        const currentHG = mapH * gridSize;
        const currentWrapOffsets: [number, number][] = [
          [0, 0],
          [currentWG, 0],
          [-currentWG, 0],
          [0, currentHG],
          [0, -currentHG],
        ];

        // Loop over wrapOffsets to handle map boundaries dynamically
        for (const [ox, oy] of currentWrapOffsets) {
          const headX = smoothPoints[numPoints - 1].x + ox;
          const headY = smoothPoints[numPoints - 1].y + oy;
          const distToCam = Math.sqrt((headX - camX) ** 2 + (headY - camY) ** 2);
          if (distToCam > fogRadiusWorld * 1.5) continue; // Skip offscreen wrapped ribbons for maximum performance

          const L = distances[numPoints - 1];

          // 1. BUILD BODY MESH WITH PERFECT FLAT ENDS AND DOME GEOMETRY
          const pxTailExtBody = smoothPoints[0].x + dirTailX * snakeRadius;
          const pyTailExtBody = smoothPoints[0].y + dirTailY * snakeRadius;
          const pxHeadExtBody = smoothPoints[numPoints - 1].x + dirHeadX * snakeRadius;
          const pyHeadExtBody = smoothPoints[numPoints - 1].y + dirHeadY * snakeRadius;

          const bodyStartIdx = globalVertexCount;
          // Raise the snake body slightly above the food (which is at Z = 1.5)
          const zOffset = 2.0 + (p.body ? p.body.length : 0) * 0.001;

          const numNodes = numPoints + 2;
          for (let j = 0; j < numNodes; j++) {
            let px = 0;
            let py = 0;
            let snx = 0;
            let sny = 0;
            let uvY = 0;

            if (j === 0) {
              px = pxTailExtBody + ox;
              py = pyTailExtBody + oy;
              snx = nx[0];
              sny = ny[0];
              uvY = -snakeRadius;
            } else if (j === numNodes - 1) {
              px = pxHeadExtBody + ox;
              py = pyHeadExtBody + oy;
              snx = nx[numPoints - 1];
              sny = ny[numPoints - 1];
              uvY = L + snakeRadius;
            } else {
              const pIdx = j - 1;
              const pPt = smoothPoints[pIdx];
              px = pPt.x + ox;
              py = pPt.y + oy;
              snx = nx[pIdx];
              sny = ny[pIdx];
              uvY = distances[pIdx];
            }

            const activeRadius = snakeRadius;

            bodyVertices.push(px + snx * activeRadius, py + sny * activeRadius, zOffset);
            bodyUVs.push(0.0, uvY);
            bodyColors.push(skinR, skinG, skinB);
            bodySnakeParams.push(snakeRadius, L);

            bodyVertices.push(px - snx * activeRadius, py - sny * activeRadius, zOffset);
            bodyUVs.push(1.0, uvY);
            bodyColors.push(skinR, skinG, skinB);
            bodySnakeParams.push(snakeRadius, L);

            globalVertexCount += 2;
          }

          for (let j = 0; j < numNodes - 1; j++) {
            const v0 = bodyStartIdx + j * 2;
            const v1 = bodyStartIdx + j * 2 + 1;
            const v2 = bodyStartIdx + (j + 1) * 2;
            const v3 = bodyStartIdx + (j + 1) * 2 + 1;

            bodyIndices.push(v0, v1, v2);
            bodyIndices.push(v1, v3, v2);
          }

          // 2. BUILD SHADOW MESH WITH PERFECT FLAT ENDS AND DOME GEOMETRY
          const pxTailExtShadow = smoothPoints[0].x + dirTailX * shadowRadius;
          const pyTailExtShadow = smoothPoints[0].y + dirTailY * shadowRadius;
          const pxHeadExtShadow = smoothPoints[numPoints - 1].x + dirHeadX * shadowRadius;
          const pyHeadExtShadow = smoothPoints[numPoints - 1].y + dirHeadY * shadowRadius;

          const shadowStartIdx = shadowVertexCount;
          const sz = 0.2 + (p.body ? p.body.length : 0) * 0.001;

          const numShadowNodes = numPoints + 2;
          for (let j = 0; j < numShadowNodes; j++) {
            let px = 0;
            let py = 0;
            let snx = 0;
            let sny = 0;
            let uvY = 0;

            if (j === 0) {
              px = pxTailExtShadow + ox;
              py = pyTailExtShadow + oy;
              snx = nx[0];
              sny = ny[0];
              uvY = -shadowRadius;
            } else if (j === numShadowNodes - 1) {
              px = pxHeadExtShadow + ox;
              py = pyHeadExtShadow + oy;
              snx = nx[numPoints - 1];
              sny = ny[numPoints - 1];
              uvY = L + shadowRadius;
            } else {
              const pIdx = j - 1;
              const pPt = smoothPoints[pIdx];
              px = pPt.x + ox;
              py = pPt.y + oy;
              snx = nx[pIdx];
              sny = ny[pIdx];
              uvY = distances[pIdx];
            }

            const activeRadius = shadowRadius;

            shadowVertices.push(px + snx * activeRadius, py + sny * activeRadius, sz);
            shadowUVs.push(0.0, uvY);
            shadowColors.push(0, 0, 0);
            shadowSnakeParams.push(shadowRadius, L);

            shadowVertices.push(px - snx * activeRadius, py - sny * activeRadius, sz);
            shadowUVs.push(1.0, uvY);
            shadowColors.push(0, 0, 0);
            shadowSnakeParams.push(shadowRadius, L);

            shadowVertexCount += 2;
          }

          for (let j = 0; j < numShadowNodes - 1; j++) {
            const v0 = shadowStartIdx + j * 2;
            const v1 = shadowStartIdx + j * 2 + 1;
            const v2 = shadowStartIdx + (j + 1) * 2;
            const v3 = shadowStartIdx + (j + 1) * 2 + 1;

            shadowIndices.push(v0, v1, v2);
            shadowIndices.push(v1, v3, v2);
          }
        }
      }
      
      // Upload body attributes dynamically
      updateDynamicAttribute(bodyGeom, 'position', bodyVertices, 3);
      updateDynamicAttribute(bodyGeom, 'uv', bodyUVs, 2);
      updateDynamicAttribute(bodyGeom, 'color', bodyColors, 3);
      updateDynamicAttribute(bodyGeom, 'snakeParams', bodySnakeParams, 2);
      updateDynamicIndex(bodyGeom, bodyIndices);
      bodyGeom.setDrawRange(0, bodyIndices.length);
      bodyGeom.computeVertexNormals();

      // Upload shadow attributes dynamically
      updateDynamicAttribute(shadowGeom, 'position', shadowVertices, 3);
      updateDynamicAttribute(shadowGeom, 'uv', shadowUVs, 2);
      updateDynamicAttribute(shadowGeom, 'color', shadowColors, 3);
      updateDynamicAttribute(shadowGeom, 'snakeParams', shadowSnakeParams, 2);
      updateDynamicIndex(shadowGeom, shadowIndices);
      shadowGeom.setDrawRange(0, shadowIndices.length);
      shadowGeom.computeVertexNormals();
    }
      
      // UPDATE EYES
      if (eyeMeshRef.current && pupilMeshRef.current) {
        let eyeCount = 0;
        let pupilCount = 0;
        for (const playerId in state.players) {
          const p = state.players[playerId];
          if (!p.body || p.body.length === 0) continue;
          
          const score = p.score || 0;
          const snakeRadius = (baseHeadRadius + score * scoreThicknessScale) * gridSize;
          const head = p.body[0];
          
          const oldP = lastState?.players[playerId];
          let start = head;
          if (oldP && oldP.body) start = oldP.body[0] || head;
          if (Math.abs(head.x - start.x) > 50 || Math.abs(head.y - start.y) > 50) start = head;
          
          const hx = (start.x + (head.x - start.x) * progress) * gridSize + gridSize/2;
          const hy = -((start.y + (head.y - start.y) * progress) * gridSize + gridSize/2);
          
          const eyeRadius = snakeRadius * 0.35;
          const pupilRadius = eyeRadius * 0.5;
          const forwardOffset = snakeRadius * 0.45;
          const sideOffset = snakeRadius * 0.45;
          // Raise the eyes and pupils to remain relative to the new snake body height (Z = 2.0)
          const snakeZ = 2.0 + p.body.length * 0.001;
          const zOffset = snakeZ + 0.1;
          
          const visAngle = -p.angle;
          const dirFx = Math.cos(visAngle);
          const dirFy = Math.sin(visAngle);
          const dirRx = Math.cos(visAngle + Math.PI/2);
          const dirRy = Math.sin(visAngle + Math.PI/2);
          
          const fogAmt = calcFogAmount(hx, hy);
          
          for (const side of [-1, 1]) {
            const ex = hx + dirFx * forwardOffset + dirRx * sideOffset * side;
            const ey = hy + dirFy * forwardOffset + dirRy * sideOffset * side;
            
            dummy.position.set(ex, ey, zOffset);
            dummy.scale.setScalar(eyeRadius);
            dummy.updateMatrix();
            eyeMeshRef.current.setMatrixAt(eyeCount, dummy.matrix);
            
            colorObj.setHex(0xffffff);
            if (fogAmt > 0) colorObj.lerp(fogColor, fogAmt);
            eyeMeshRef.current.setColorAt(eyeCount, colorObj);
            eyeCount++;
            
            const px = ex + dirFx * (eyeRadius * 0.3);
            const py = ey + dirFy * (eyeRadius * 0.3);
            
            dummy.position.set(px, py, zOffset + 0.01);
            dummy.scale.setScalar(pupilRadius);
            dummy.updateMatrix();
            pupilMeshRef.current.setMatrixAt(pupilCount, dummy.matrix);
            
            colorObj.setHex(0x000000);
            if (fogAmt > 0) colorObj.lerp(fogColor, fogAmt);
            pupilMeshRef.current.setColorAt(pupilCount, colorObj);
            pupilCount++;
          }
        }
        eyeMeshRef.current.count = eyeCount;
        eyeMeshRef.current.instanceMatrix.needsUpdate = true;
        if (eyeMeshRef.current.instanceColor) eyeMeshRef.current.instanceColor.needsUpdate = true;
        
        pupilMeshRef.current.count = pupilCount;
        pupilMeshRef.current.instanceMatrix.needsUpdate = true;
        if (pupilMeshRef.current.instanceColor) pupilMeshRef.current.instanceColor.needsUpdate = true;
      }

      // UPDATE NICKNAMES DYNAMICALLY (60FPS)
      for (const playerId in state.players) {
        const p = state.players[playerId];
        const oldP = lastState?.players[playerId];
        if (!p.body || p.body.length === 0) continue;
        
        let targetX = p.body[0].x;
        let targetY = p.body[0].y;

        let alpha = 1.0;
        if ((p as any).spawn_protection_time && (p as any).spawn_protection_time > 0) {
          if ((p as any).spawn_protection_time < 2.0) {
            alpha = 0.5 + Math.sin(time * 0.02) * 0.3;
          }
        }
        
        let startX = targetX;
        let startY = targetY;
        if (oldP && oldP.body && oldP.body.length > 0) {
          startX = oldP.body[0].x;
          startY = oldP.body[0].y;
        }
        if (Math.abs(targetX - startX) > 50 || Math.abs(targetY - startY) > 50) {
          startX = targetX;
          startY = targetY;
        }
        
        const lx = startX + (targetX - startX) * progress;
        const ly = startY + (targetY - startY) * progress;
        
        const worldX = lx * gridSize + gridSize/2;
        const worldY = -(ly * gridSize + gridSize/2);
        
        // Find shortest path to camera
        let dx = worldX - camX;
        let dy = worldY - camY;
        if (dx > (mapW*gridSize)/2) dx -= mapW*gridSize;
        else if (dx < -(mapW*gridSize)/2) dx += mapW*gridSize;
        if (dy > (mapH*gridSize)/2) dy -= mapH*gridSize;
        else if (dy < -(mapH*gridSize)/2) dy += mapH*gridSize;
        
        const wX = camX + dx;
        const wY = camY + dy;
        
        const score = p.score || 0;
        const snakeRadius = (baseHeadRadius + score * scoreThicknessScale) * gridSize;
        
        const textObj = textRefs.current[playerId];
        if (textObj) {
          textObj.position.set(wX, wY, snakeRadius + 20);
          textObj.quaternion.copy(camera.quaternion);
          textObj.fillOpacity = alpha;
        }
      }

      // UPDATE PARTICLES
    const activeParticles = particlesRef.current;
    if (particleMeshRef.current) {
      let count = 0;
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
          activeParticles[i] = activeParticles[activeParticles.length - 1];
          activeParticles.pop();
          continue;
        }
        if (count >= 2000) break;

        p.vx *= Math.max(0.1, 1 - 1.5 * dt);
        p.vy *= Math.max(0.1, 1 - 1.5 * dt);
        
        const pSize = gridSize * p.size;
        dummy.position.set(p.x * gridSize + gridSize/2, -(p.y * gridSize + gridSize/2), 1.2);
        dummy.scale.setScalar(pSize);
        // Particles rotate randomly
        dummy.rotation.set(0, 0, p.life * 5.0);
        dummy.updateMatrix();
        particleMeshRef.current.setMatrixAt(count, dummy.matrix);
        colorObj.set(p.color);
        const fogAmt = calcFogAmount(dummy.position.x, dummy.position.y);
        if (fogAmt > 0) colorObj.lerp(fogColor, fogAmt);
        particleMeshRef.current.setColorAt(count, colorObj);
        count++;
      }
      particleMeshRef.current.count = count;
      particleMeshRef.current.instanceMatrix.needsUpdate = true;
      if (particleMeshRef.current.instanceColor) particleMeshRef.current.instanceColor.needsUpdate = true;
    }
    
    // DEATH CHECKS (moved into useFrame to avoid extra RAF)
    if (time - camState.current.lastDeathCheckTime > 200) {
      camState.current.lastDeathCheckTime = time;
      if (state && lastState && lastState.players) {
        for (const pid in lastState.players) {
          const lastP = lastState.players[pid];
          const currP = state.players[pid];
          const died = !currP || (currP.deaths > lastP.deaths);
          if (died && lastP.body && lastP.body.length > 0) {
            const head = lastP.body[0];
            let baseColor = parseColor(lastP.skin || "#22c55e");
            if (lastP.skin === "zebra") baseColor = 0xe5e5e5;
            else if (lastP.skin === "tiger") baseColor = 0xf97316;
            else if (lastP.skin === "cyberpunk") baseColor = 0xff00ff;

            for (let i = 0; i < 35; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 3.0 + Math.random() * 8.0;
              let pColor = baseColor;
              if (lastP.skin === "rainbow") pColor = hslToHex(Math.random() * 360, 1, 0.5);
              activeParticles.push({
                x: head.x,
                y: head.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: pColor,
                size: 0.15 + Math.random() * 0.25,
                life: 0.6 + Math.random() * 0.6,
              });
            }
          }
        }
      }
    }
  });

  // Resource cleanup on unmount
  useEffect(() => {
    return () => {
      [foodMat, foodShadowMat, snakeMat, eyeMat, pupilMat, particleMat, groundMaterial].forEach(mat => mat.dispose());
      [planeGeo, flatCircleGeo, pupilGeo, particleGeo].forEach(geo => geo.dispose());
      if (bodyGeometryRef.current) bodyGeometryRef.current.dispose();
      if (shadowGeometryRef.current) shadowGeometryRef.current.dispose();
    };
  }, []);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[100, 100, 200]} intensity={1.2} />
      
      {/* Custom Infinite Floor with Fog and Grid */}
      <mesh ref={groundMeshRef} position={[(WORLD_WIDTH*gridSize)/2, -(WORLD_HEIGHT*gridSize)/2, -2.0]}>
        <planeGeometry args={[WORLD_WIDTH*gridSize*4, WORLD_HEIGHT*gridSize*4]} />
        <primitive object={groundMaterial} attach="material" />
      </mesh>

      {/* Main entities third (rendered on top of shadows and glows) */}
      <instancedMesh ref={foodShadowMeshRef} args={[planeGeo, foodShadowMat, 5000]} frustumCulled={false} renderOrder={0} />
      <instancedMesh ref={foodMeshRef} args={[planeGeo, foodMat, 5000]} frustumCulled={false} renderOrder={1} />
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
      
      {activePlayerIds.filter((n: any) => !n.isMe).map((n: any) => {
        return (
          <Text
            key={n.id}
            ref={(r) => { if (r) textRefs.current[n.id] = r; else delete textRefs.current[n.id]; }}
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
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  // checkDeaths effect was moved into useFrame

  // Render Minimap
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animId: number;
    let lastDrawTime = 0;
    const draw = (time: number) => {
      animId = requestAnimationFrame(draw);
      
      // Throttle to ~15 FPS (66ms)
      if (time - lastDrawTime < 66) return;
      lastDrawTime = time;
      
      const state = gameStateRef.current;
      if (state && state.players && state.foods) {
        ctx.clearRect(0, 0, 150, 150);
        // Soft dark overlay to maintain dot contrast without blocking the glassmorphism backdrop blur
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(0, 0, 150, 150);
        const mapW = state.server_world?.width ?? WORLD_WIDTH;
        const mapH = state.server_world?.height ?? WORLD_HEIGHT;
        const mapScaleX = 150 / mapW;
        const mapScaleY = 150 / mapH;

        for (let i = 0; i < state.foods.length; i++) {
          const f = state.foods[i];
          ctx.fillStyle = f.color || '#ef4444';
          ctx.globalAlpha = f.value >= 2 ? 0.8 : 0.5;
          const s = f.value >= 50 ? 5 : f.value >= 20 ? 4 : 2;
          ctx.fillRect(f.x * mapScaleX - s/2, f.y * mapScaleY - s/2, s, s);
        }
        ctx.globalAlpha = 1.0;

        const dotSize = 3.5;
        // Draw other players first
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

        // Draw self player on top in bright white
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
  }, [gameStateRef, myIdRef]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#0c0c0f' }}>
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
          particlesRef={particlesRef}
          controlModeRef={controlModeRef}
          socketRef={socketRef}
          isMobile={isMobile}
        />
      </Canvas>
      <div 
        className="hud-minimap-container"
        style={{ 
          position: 'absolute', 
          top: isMobile ? 72 : 'auto',
          left: isMobile ? 12 : 'auto',
          bottom: isMobile ? 'auto' : 20, 
          right: isMobile ? 'auto' : 20, 
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
        <canvas ref={minimapCanvasRef} width={150} height={150} style={{ display: "block" }} />
      </div>
    </div>
  );
});

GameRenderer.displayName = "GameRenderer";
