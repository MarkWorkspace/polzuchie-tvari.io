// ROLE: One-instance-draw decorative grass field: geometry, material, wind shader and rebuild throttle.
// Purely visual: no collision, no gameplay, no server knowledge.

import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import {
  createGrassTuftBuffer,
  DECOR_BUDGET_CAPS,
  GRASS_CELL_DENSITY,
  GRASS_CELL_DIVISIONS,
  GRASS_SEED,
  type GrassFieldConfig,
  type GrassPlacementView,
  type GrassTuftBuffer,
  getLastCalibratedDensity,
  placeGrassTufts,
} from "./DecorField";
import { DecorUpdateGate, type DecorViewState } from "./DecorUpdateGate";
import { RenderConfig, RenderLayer } from "./RenderConfig";

const MAX_INSTANCES = DECOR_BUDGET_CAPS.grass;
const FALLBACK_FOG_RADIUS = 900;
export const GRASS_GROUND_Z = -1.9;
const GRASS_PUSH_DISABLED = 1e6;
/** Near tufts get a soft root-shadow decal; far tufts are too small to need one. */
const ROOT_SHADOW_BUDGET = 4096;

/** The field always covers at least this radius so a close camera keeps a stable field. */
export const GRASS_MIN_CULL_RADIUS = 550;
/** Cap for the cull radius: a fixed instance budget cannot cover more without turning to dust. */
export const GRASS_MAX_CULL_RADIUS = 1200;
/**
 * Spectator cameras can sit far above the field; 800 units covers a follow
 * view at the 600-unit follow zoom while keeping the budget dense enough.
 */
export const GRASS_SPECTATOR_CULL_RADIUS = 800;
/** Fallback player field radius when a caller does not provide a preset value. */
const GRASS_FIELD_RADIUS_FALLBACK = 600;
/** Tuft scale cap for far cameras, so the field stays legible in the overview. */
export const GRASS_LOD_SCALE_MAX = 2.6;
/** View half-extent (world units) at which tufts reach their maximum LOD scale. */
export const GRASS_LOD_EXTENT = 300;

const BLADE_HEIGHT = 4.0;
const BLADE_BASE_WIDTH = 2.35;
const BLADE_TIP_WIDTH = 0.82;
const BLADE_COUNT = 5;
const BLADE_TINTS = [0.94, 1.02, 1.04, 0.96, 1.0];

// Base-to-tip shade. Multiplied by the per-instance colour. A darker root
// makes the field read as one dense mass instead of separate star-shaped tufts.
const VERTEX_SHADE_BASE = 0.38;
const VERTEX_SHADE_MID = 0.79;
const VERTEX_SHADE_TIP = 1.0;

const SHADE_COLOR = 0x435c2d;
const LIGHT_COLOR = 0xa3bf60;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Camera-aware cull radius. The field keeps covering the visible ground when
 * the camera zooms out (spectator overview/follow), while a fixed instance
 * budget keeps the cost flat by lowering density.
 */
export function grassCullRadius(fogRadiusWorld: number, viewHalfExtent: number): number {
  const fog = Number.isFinite(fogRadiusWorld) && fogRadiusWorld > 0 ? fogRadiusWorld : 0;
  const extent = Number.isFinite(viewHalfExtent) && viewHalfExtent > 0 ? viewHalfExtent : 0;
  const wanted = Math.max(fog * 1.1, extent * 1.1);
  return Math.min(GRASS_MAX_CULL_RADIUS, Math.max(GRASS_MIN_CULL_RADIUS, wanted));
}

/** Grows tufts with the visible extent so a zoomed-out field still reads as grass. */
export function grassLodScale(viewHalfExtent: number): number {
  const extent = Number.isFinite(viewHalfExtent) && viewHalfExtent > 0 ? viewHalfExtent : 0;
  return Math.min(GRASS_LOD_SCALE_MAX, Math.max(1, extent / GRASS_LOD_EXTENT));
}

function createTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bladeAngles = [0.4, 1.45, 2.35, 3.5, 5.1];
  const bladeHeights = [0.82, 1.0, 0.92, 0.78, 0.88];
  // Wider offsets/leans make each tuft a low rosette instead of a tight
  // bunch, so neighbouring tufts interleave and the lawn reads as a carpet.
  const bladeOffsets = [0.8, 1.6, 1.1, 0.9, 1.8];
  const bladeLeans = [2.0, 3.0, 2.4, 1.6, 2.7];

  for (let b = 0; b < BLADE_COUNT; b++) {
    const angle = bladeAngles[b];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const sideX = -sin;
    const sideY = cos;
    const baseX = cos * bladeOffsets[b];
    const baseY = sin * bladeOffsets[b];
    const height = BLADE_HEIGHT * bladeHeights[b];
    const lean = bladeLeans[b];
    const midT = 0.55;
    const midX = baseX + cos * lean * midT;
    const midY = baseY + sin * lean * midT;
    const tipX = baseX + cos * lean;
    const tipY = baseY + sin * lean;

    const base = positions.length / 3;
    positions.push(
      baseX - sideX * BLADE_BASE_WIDTH * 0.5,
      baseY - sideY * BLADE_BASE_WIDTH * 0.5,
      0,
      baseX + sideX * BLADE_BASE_WIDTH * 0.5,
      baseY + sideY * BLADE_BASE_WIDTH * 0.5,
      0,
      midX - sideX * BLADE_TIP_WIDTH * 0.5,
      midY - sideY * BLADE_TIP_WIDTH * 0.5,
      height * midT,
      midX + sideX * BLADE_TIP_WIDTH * 0.5,
      midY + sideY * BLADE_TIP_WIDTH * 0.5,
      height * midT,
      tipX,
      tipY,
      height,
    );

    // Blades are lit like the ground they grow from, so the field stays readable
    // from every camera heading instead of half the blades going black. The
    // per-blade tint below supplies the volume cue instead of tilted normals.
    for (let i = 0; i < 5; i++) normals.push(0, 0, 1);

    const tint = BLADE_TINTS[b];
    colors.push(
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_BASE * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_MID * tint,
      VERTEX_SHADE_TIP * tint,
      VERTEX_SHADE_TIP * tint,
      VERTEX_SHADE_TIP * tint,
    );

    indices.push(
      base,
      base + 1,
      base + 2,
      base + 1,
      base + 3,
      base + 2,
      base + 2,
      base + 3,
      base + 4,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
  geometry.computeBoundingSphere = () => {
    /* manual culling: never recompute per frame */
  };
  return geometry;
}

/** Structural view of the contact shadow the grass shader can sample. */
export interface ContactShadowFrame {
  texture: THREE.Texture;
  x: number;
  y: number;
  halfExtent: number;
}

function createEmptyShadowTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  texture.needsUpdate = true;
  return texture;
}

/** Soft, texture-free contact patch that anchors a tuft to the ground. */
function createRootShadowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRootColor: { value: new THREE.Color(0x2f3d22) },
      uRootOpacity: { value: 0.45 },
    },
    vertexShader: `
      varying vec2 vRootUv;
      void main() {
        vRootUv = uv;
        vec4 local = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          local = instanceMatrix * local;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * local;
      }
    `,
    fragmentShader: `
      varying vec2 vRootUv;
      uniform vec3 uRootColor;
      uniform float uRootOpacity;
      void main() {
        float radius = length(vRootUv - 0.5) * 2.0;
        float alpha = (1.0 - smoothstep(0.12, 1.0, radius)) * uRootOpacity;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uRootColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

/** Grass is opaque, so a ground-level decal is invisible; tint blades instead. */
const GRASS_SHADOW_TINT = new THREE.Vector3(0.42, 0.5, 0.68);

export class GrassRenderer {
  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly rootMesh: THREE.InstancedMesh;
  private readonly rootMaterial: THREE.ShaderMaterial;
  private readonly tufts: GrassTuftBuffer;
  private readonly fieldConfig: GrassFieldConfig;
  private readonly emptyShadow = createEmptyShadowTexture();
  private readonly uniforms = {
    uTime: { value: 0 },
    uWindStrength: { value: 1 },
    uPlayerPos: { value: new THREE.Vector2() },
    uShadowMap: { value: this.emptyShadow as THREE.Texture },
    uShadowCenter: { value: new THREE.Vector2() },
    uShadowHalfExtent: { value: 180 },
    uShadowStrength: { value: 0 },
    uShadowTint: { value: GRASS_SHADOW_TINT },
    uFieldCenter: { value: new THREE.Vector2() },
    uFieldRadius: { value: 1 },
    uFadeNear: { value: 250 },
    uFadeFar: { value: 850 },
  };
  private readonly shadeColor = new THREE.Color(SHADE_COLOR);
  private readonly lightColor = new THREE.Color(LIGHT_COLOR);
  private readonly dryColor = new THREE.Color(0xb0a45c);
  private readonly scratchColor = new THREE.Color();
  private readonly gate = new DecorUpdateGate();
  private readonly densityCache = new Map<string, number>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tufts = createGrassTuftBuffer(MAX_INSTANCES);
    this.fieldConfig = {
      seed: GRASS_SEED,
      gridSize: gridSize / GRASS_CELL_DIVISIONS,
      mapCellsX: WORLD_WIDTH * GRASS_CELL_DIVISIONS,
      mapCellsY: WORLD_HEIGHT * GRASS_CELL_DIVISIONS,
      density: GRASS_CELL_DENSITY,
    };

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.patchMaterial(this.material);

    this.mesh = new THREE.InstancedMesh(createTuftGeometry(), this.material, MAX_INSTANCES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const colors = new THREE.InstancedBufferAttribute(new Float32Array(MAX_INSTANCES * 3), 3);
    colors.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = colors;

    RenderConfig.configureMesh(this.mesh, RenderLayer.Opaque, {
      castShadow: false,
      receiveShadow: false,
      frustumCulled: false,
    });
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    this.rootMaterial = createRootShadowMaterial();
    this.rootMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(7.0, 7.0),
      this.rootMaterial,
      MAX_INSTANCES,
    );
    // Root shadows are the nearest tufts only; sharing the matrix keeps the
    // rebuild cost and memory identical to the grass mesh.
    this.rootMesh.instanceMatrix = this.mesh.instanceMatrix;
    this.rootMesh.position.z = 0.01;
    RenderConfig.configureMesh(this.rootMesh, RenderLayer.Shadow, {
      castShadow: false,
      receiveShadow: false,
      frustumCulled: false,
    });
    this.rootMesh.count = 0;
    this.rootMesh.visible = false;
    this.scene.add(this.rootMesh);
  }

  public update(
    frame: any,
    budget: number,
    nowMs: number,
    targetX: number,
    targetY: number,
    viewHalfExtent: number,
    fieldRadius: number,
    cameraView: GrassPlacementView | null | undefined,
    contactShadow?: ContactShadowFrame | null,
  ): void {
    const camX = finiteOr(targetX, finiteOr(frame?.camX, 0));
    const camY = finiteOr(targetY, finiteOr(frame?.camY, 0));
    const isSpectator = frame?.myId === "spectator_id";
    const pushX = isSpectator ? GRASS_PUSH_DISABLED : finiteOr(frame?.camX, camX);
    const pushY = isSpectator ? GRASS_PUSH_DISABLED : finiteOr(frame?.camY, camY);
    this.uniforms.uTime.value = nowMs * 0.001;
    this.uniforms.uPlayerPos.value.set(pushX, pushY);
    // The shadow mask is sampled in the vertex shader, so opaque blades under
    // the ribbon darken instead of hiding a ground decal. One frame behind the
    // mask render is invisible at 60 fps and keeps the passes independent.
    this.uniforms.uShadowMap.value = contactShadow?.texture ?? this.emptyShadow;
    this.uniforms.uShadowStrength.value = contactShadow ? 1 : 0;
    if (contactShadow) {
      this.uniforms.uShadowCenter.value.set(contactShadow.x, contactShadow.y);
      this.uniforms.uShadowHalfExtent.value = Math.max(1, contactShadow.halfExtent);
    }

    const instanceBudget = Number.isFinite(budget) ? Math.min(budget, MAX_INSTANCES) : 0;
    if (instanceBudget <= 0) {
      this.mesh.count = 0;
      this.mesh.visible = false;
      this.rootMesh.count = 0;
      this.rootMesh.visible = false;
      this.gate.invalidate();
      if (import.meta.env.DEV && typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__decorGrassStats = {
          budget: 0,
          count: 0,
          rootCount: 0,
          cullRadius: 0,
          rebuildMs: 0,
        };
      }
      return;
    }

    const mapX = Math.max(
      1,
      Math.floor((frame?.gameState?.server_world?.width ?? WORLD_WIDTH) * GRASS_CELL_DIVISIONS),
    );
    const mapY = Math.max(
      1,
      Math.floor((frame?.gameState?.server_world?.height ?? WORLD_HEIGHT) * GRASS_CELL_DIVISIONS),
    );

    const fogRadius =
      Number.isFinite(frame?.fogRadiusWorld) && frame.fogRadiusWorld > 0
        ? frame.fogRadiusWorld
        : FALLBACK_FOG_RADIUS;
    // Player view concentrates the budget in the near field; the spectator
    // follow view gets a fixed 800-unit field, while the overview is hidden by
    // the camera-distance LOD. Both use the same placement logic.
    const playerRadius =
      Number.isFinite(fieldRadius) && fieldRadius > 0 ? fieldRadius : GRASS_FIELD_RADIUS_FALLBACK;
    const fieldCap = isSpectator ? GRASS_SPECTATOR_CULL_RADIUS : playerRadius;
    const cullRadius = isSpectator
      ? GRASS_SPECTATOR_CULL_RADIUS
      : Math.min(grassCullRadius(fogRadius, viewHalfExtent), fieldCap);
    const lodScale = grassLodScale(viewHalfExtent);
    this.uniforms.uFieldCenter.value.set(camX, camY);
    this.uniforms.uFieldRadius.value = Math.max(1, cullRadius);
    this.uniforms.uFadeNear.value =
      Number.isFinite(cameraView?.near) && (cameraView?.near ?? 0) > 0
        ? (cameraView?.near ?? 250)
        : 250;
    this.uniforms.uFadeFar.value =
      Number.isFinite(cameraView?.far) && (cameraView?.far ?? 0) > 0
        ? Math.max(this.uniforms.uFadeNear.value + 1, cameraView?.far ?? 850)
        : 850;

    const state: DecorViewState = {
      nowMs,
      camX,
      camY,
      mapX,
      mapY,
      budget: instanceBudget,
      cullRadius,
      viewExtent: viewHalfExtent,
      viewKey: Number.isFinite(cameraView?.viewKey) ? (cameraView?.viewKey ?? 0) : 0,
    };
    if (!this.gate.shouldRebuild(state)) return;

    this.rebuild(instanceBudget, mapX, mapY, camX, camY, cullRadius, lodScale, cameraView);
    this.gate.markBuilt(state);
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
    this.scene.remove(this.rootMesh);
    this.mesh.geometry.dispose();
    this.mesh.instanceMatrix.dispose();
    this.material.dispose();
    this.mesh.instanceColor?.dispose();
    this.rootMesh.geometry.dispose();
    this.rootMaterial.dispose();
    this.emptyShadow.dispose();
  }

  private rebuild(
    budget: number,
    mapX: number,
    mapY: number,
    camX: number,
    camY: number,
    cullRadius: number,
    lodScale: number,
    cameraView: GrassPlacementView | null | undefined,
  ): void {
    this.fieldConfig.mapCellsX = mapX;
    this.fieldConfig.mapCellsY = mapY;

    const rebuildStartedAt = import.meta.env.DEV ? performance.now() : 0;
    const densityKey = `${budget}|${Math.round(cullRadius)}|${mapX}|${mapY}`;
    const cachedDensity = this.densityCache.get(densityKey);
    const count = placeGrassTufts(
      camX,
      camY,
      cullRadius,
      budget,
      this.fieldConfig,
      this.tufts,
      cameraView,
      cachedDensity,
    );
    if (cachedDensity === undefined) {
      const density = getLastCalibratedDensity();
      if (density > 0) this.densityCache.set(densityKey, density);
    }
    this.writeInstances(count, lodScale);
    const rootCount = Math.min(count, ROOT_SHADOW_BUDGET);
    if (import.meta.env.DEV && typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__decorGrassStats = {
        budget,
        count,
        rootCount,
        cullRadius,
        rebuildMs: performance.now() - rebuildStartedAt,
      };
    }

    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.rootMesh.count = rootCount;
    this.rootMesh.visible = rootCount > 0;
    this.rootMesh.instanceMatrix.needsUpdate = true;
  }

  private writeInstances(count: number, lodScale: number): void {
    const matrices = this.mesh.instanceMatrix.array as Float32Array;
    const colors = this.mesh.instanceColor?.array as Float32Array | undefined;
    const { x, y, yaw, scale, colorMix } = this.tufts;

    for (let i = 0; i < count; i++) {
      const o = i * 16;
      const s = scale[i] * lodScale;
      const cos = Math.cos(yaw[i]) * s;
      const sin = Math.sin(yaw[i]) * s;

      matrices[o] = cos;
      matrices[o + 1] = sin;
      matrices[o + 2] = 0;
      matrices[o + 3] = 0;
      matrices[o + 4] = -sin;
      matrices[o + 5] = cos;
      matrices[o + 6] = 0;
      matrices[o + 7] = 0;
      matrices[o + 8] = 0;
      matrices[o + 9] = 0;
      matrices[o + 10] = s;
      matrices[o + 11] = 0;
      matrices[o + 12] = x[i];
      matrices[o + 13] = y[i];
      matrices[o + 14] = GRASS_GROUND_Z;
      matrices[o + 15] = 1;

      if (colors) {
        const c = this.scratchColor.lerpColors(this.shadeColor, this.lightColor, colorMix[i]);
        // A few dry tufts break the uniform lime carpet without a second field.
        if (colorMix[i] > 0.88) {
          c.lerp(this.dryColor, ((colorMix[i] - 0.88) / 0.12) * 0.45);
        }
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
    }

    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, count * 16);
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.clearUpdateRanges();
      this.mesh.instanceColor.addUpdateRange(0, count * 3);
    }
  }

  private patchMaterial(material: THREE.MeshStandardMaterial): void {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uWindStrength = this.uniforms.uWindStrength;
      shader.uniforms.uPlayerPos = this.uniforms.uPlayerPos;
      shader.uniforms.uShadowMap = this.uniforms.uShadowMap;
      shader.uniforms.uShadowCenter = this.uniforms.uShadowCenter;
      shader.uniforms.uShadowHalfExtent = this.uniforms.uShadowHalfExtent;
      shader.uniforms.uShadowStrength = this.uniforms.uShadowStrength;
      shader.uniforms.uShadowTint = this.uniforms.uShadowTint;
      shader.uniforms.uFieldCenter = this.uniforms.uFieldCenter;
      shader.uniforms.uFieldRadius = this.uniforms.uFieldRadius;
      shader.uniforms.uFadeNear = this.uniforms.uFadeNear;
      shader.uniforms.uFadeFar = this.uniforms.uFadeFar;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uWindStrength;
        uniform float uFadeNear;
        uniform float uFadeFar;
        uniform vec2 uPlayerPos;
        uniform sampler2D uShadowMap;
        uniform vec2 uShadowCenter;
        uniform float uShadowHalfExtent;
        uniform float uShadowStrength;
        uniform vec2 uFieldCenter;
        uniform float uFieldRadius;
        varying float vGrassShadow;
        float grassBend = 0.0;
      ${shader.vertexShader}`;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>

        // Only the bend mask is local; the wind itself is applied in world
        // space after the instance matrix, so all tufts move together.
        float grassT = clamp(position.z / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
        grassBend = grassT * grassT;

        // Smooth camera-distance LOD. Far tufts shrink to their root instead of
        // popping out with the CPU instance set, so LOD changes are continuous.
        #ifdef USE_INSTANCING
          vec2 grassFadeRoot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy;
        #else
          vec2 grassFadeRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy;
        #endif
        float grassFadeDistance =
          length(vec3(grassFadeRoot, ${GRASS_GROUND_Z.toFixed(2)}) - cameraPosition);
        float grassFarFade = 1.0 - smoothstep(uFadeNear, uFadeFar, grassFadeDistance);
        transformed *= grassFarFade;
        `,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `
        // The blurred ribbon mask is sampled at the tuft root before the vertex
        // matrices are applied. The same coverage both tints and flattens the
        // blades, so the opaque field cannot swallow the snake body.
        #ifdef USE_INSTANCING
          vec4 grassRootWorld = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #else
          vec4 grassRootWorld = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif
        vec2 grassShadowUv = (grassRootWorld.xy - uShadowCenter) / (2.0 * uShadowHalfExtent) + 0.5;
        vec2 shadowInside = step(vec2(0.0), grassShadowUv) * step(grassShadowUv, vec2(1.0));
        float shadowCoverage =
          texture2D(uShadowMap, grassShadowUv).r * shadowInside.x * shadowInside.y;
        float grassFlatten = smoothstep(0.05, 0.35, shadowCoverage) * uShadowStrength;
        transformed.z *= 1.0 - grassFlatten * 0.95;

        vec4 mvPosition = vec4( transformed, 1.0 );

        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif

        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif

        // Ghost of Tsushima's wind is one global direction with a low-frequency
        // Perlin magnitude, not per-tuft noise. Two world-space waves plus a
        // small cross-wind flutter give the whole field a coherent gust front.
        vec2 grassWindDir = normalize(vec2(0.82, 0.57));
        float grassWindSide =
          sin(dot(grassRootWorld.xy, vec2(-0.045, 0.060)) - uTime * 0.70);
        vec2 grassWind = normalize(
          grassWindDir + vec2(-grassWindDir.y, grassWindDir.x) * grassWindSide * 0.22
        );
        float grassGustA =
          0.55 + 0.45 * sin(dot(grassRootWorld.xy, vec2(0.081, 0.047)) - uTime * 1.25);
        float grassGustB =
          0.65 + 0.35 * sin(dot(grassRootWorld.xy, vec2(0.026, 0.015)) - uTime * 0.45);
        float grassWindAmp = (1.1 + 0.55 * grassGustA * grassGustB) * uWindStrength;
        float grassFlutter =
          sin(uTime * 3.3 + grassRootWorld.x * 0.7 + grassRootWorld.y * 0.9) * 0.12;
        mvPosition.xy += grassWind * grassWindAmp * grassBend;
        mvPosition.xy +=
          vec2(-grassWind.y, grassWind.x) * grassFlutter * grassBend;

        vec4 grassWorld = modelMatrix * mvPosition;
        vec2 grassToPlayer = grassWorld.xy - uPlayerPos;
        float grassDist = length(grassToPlayer);
        // The head parts the grass only in its immediate neighbourhood; the
        // ribbon shadow handles the rest of the body.
        float grassPush = (1.0 - smoothstep(8.0, 24.0, grassDist)) * grassBend * 1.6;
        mvPosition.xy += (grassToPlayer / max(grassDist, 0.001)) * grassPush;

        vGrassShadow = clamp(shadowCoverage * 1.6, 0.0, 1.0) * uShadowStrength;

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;

        // Hide the edge of the instanced field with a stable world-space
        // dither instead of a hard ring. Every vertex of a tuft shares the
        // same root hash, so whole tufts disappear together.
        float fieldEdge = length(grassRootWorld.xy - uFieldCenter) / max(uFieldRadius, 1.0);
        float fieldKeep = 1.0 - smoothstep(0.9, 1.0, fieldEdge);
        float fieldNoise = fract(sin(dot(grassRootWorld.xy, vec2(12.9898, 78.233))) * 43758.5453);
        if (fieldNoise > fieldKeep) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
        `,
      );

      shader.fragmentShader = `varying float vGrassShadow;
      uniform vec3 uShadowTint;
      ${shader.fragmentShader}`;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(1.0), uShadowTint, vGrassShadow);
        `,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
        #ifdef DOUBLE_SIDED
          normal *= faceDirection;
        #endif
        `,
      );
    };
  }
}
