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
import { GRASS_TRAIL_MAX_POINTS, GrassTrail, resolveGrassTrailPoint } from "./GrassTrail";
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
const GRASS_FIELD_RADIUS_FALLBACK = 500;
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
/** Crushed blades lose their fresh green; the trail gets a separate dry-olive tint. */
const GRASS_TRAIL_TINT = new THREE.Vector3(0.46, 0.42, 0.26);

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
    uTrailTint: { value: GRASS_TRAIL_TINT },
    uShadowDilate: { value: 0.016 },
    uFieldCenter: { value: new THREE.Vector2() },
    uFieldRadius: { value: 1 },
    uFadeNear: { value: 250 },
    uFadeFar: { value: 850 },
    uTrail: { value: new Float32Array(GRASS_TRAIL_MAX_POINTS * 4) },
    uTrailCount: { value: 0 },
  };
  private readonly shadeColor = new THREE.Color(SHADE_COLOR);
  private readonly lightColor = new THREE.Color(LIGHT_COLOR);
  private readonly dryColor = new THREE.Color(0xb0a45c);
  private readonly scratchColor = new THREE.Color();
  private readonly gate = new DecorUpdateGate();
  private readonly densityCache = new Map<string, number>();
  private readonly trail = new GrassTrail();
  private lastTrailCount = 0;

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
    if (isSpectator) {
      this.trail.reset();
      this.uniforms.uTrailCount.value = 0;
      this.lastTrailCount = 0;
    } else {
      const trailPoint = resolveGrassTrailPoint(frame, pushX, pushY);
      this.trail.update(nowMs, trailPoint.x, trailPoint.y);
      this.lastTrailCount = this.trail.fill(nowMs, this.uniforms.uTrail.value as Float32Array);
      this.uniforms.uTrailCount.value = this.lastTrailCount;
    }

    // The shadow mask is sampled in the vertex shader, so opaque blades under
    // the ribbon darken instead of hiding a ground decal. One frame behind the
    // mask render is invisible at 60 fps and keeps the passes independent.
    this.uniforms.uShadowMap.value = contactShadow?.texture ?? this.emptyShadow;
    this.uniforms.uShadowStrength.value = contactShadow ? 1 : 0;
    if (contactShadow) {
      this.uniforms.uShadowCenter.value.set(contactShadow.x, contactShadow.y);
      this.uniforms.uShadowHalfExtent.value = Math.max(1, contactShadow.halfExtent);
      // Keep the trample halo a constant world-space width on every zoom.
      this.uniforms.uShadowDilate.value = 12 / (2 * this.uniforms.uShadowHalfExtent.value);
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
          trailCount: 0,
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
        trailCount: this.lastTrailCount,
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
      shader.uniforms.uTrailTint = this.uniforms.uTrailTint;
      shader.uniforms.uShadowDilate = this.uniforms.uShadowDilate;
      shader.uniforms.uTrail = this.uniforms.uTrail;
      shader.uniforms.uTrailCount = this.uniforms.uTrailCount;
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
        uniform float uShadowDilate;
        uniform vec4 uTrail[${GRASS_TRAIL_MAX_POINTS}];
        uniform int uTrailCount;
        uniform vec2 uFieldCenter;
        uniform float uFieldRadius;
        varying float vGrassShadow;
        varying float vGrassTrail;
        float grassBend = 0.0;

        // Cheap sin-free hashes keep the gust noise affordable on integrated
        // GPUs. The field is evaluated per vertex, so this runs ~280k times a
        // frame at the current player budget.
        float grassHash21(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
        }

        float grassValueNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(grassHash21(i), grassHash21(i + vec2(1.0, 0.0)), u.x),
            mix(grassHash21(i + vec2(0.0, 1.0)), grassHash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float grassFbm(vec2 p) {
          return grassValueNoise(p) * 0.62 +
            grassValueNoise(p * 2.13 + vec2(19.7, 7.3)) * 0.38;
        }
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
        // Dilate the blurred silhouette a little at the tuft root, so blades
        // leaning into the body are flattened too, not only roots directly under it.
        float shadowCoverage = texture2D(uShadowMap, grassShadowUv).r;
        shadowCoverage = max(
          shadowCoverage,
          texture2D(uShadowMap, grassShadowUv + vec2(uShadowDilate, 0.0)).r
        );
        shadowCoverage = max(
          shadowCoverage,
          texture2D(uShadowMap, grassShadowUv - vec2(uShadowDilate, 0.0)).r
        );
        shadowCoverage = max(
          shadowCoverage,
          texture2D(uShadowMap, grassShadowUv + vec2(0.0, uShadowDilate)).r
        );
        shadowCoverage = max(
          shadowCoverage,
          texture2D(uShadowMap, grassShadowUv - vec2(0.0, uShadowDilate)).r
        );
        shadowCoverage *= shadowInside.x * shadowInside.y;

        float grassFlattenFromShadow = clamp(
          smoothstep(0.01, 0.38, shadowCoverage) * uShadowStrength,
          0.0,
          1.0
        );
        float trailFlatten = 0.0;
        vec2 trailBendVec = vec2(0.0);
        if (uTrailCount > 0) {
          vec4 trailFirst = uTrail[0];
          trailFlatten =
            (1.0 - smoothstep(0.0, 10.0, distance(grassRootWorld.xy, trailFirst.xy))) *
            trailFirst.z;
        }
        // Points are sampled every 250 ms. Treat consecutive points as a
        // segment so a fast snake leaves a continuous trail instead of a row
        // of dots, and so the 32-second history fits a modest uniform array.
        for (int i = 1; i < ${GRASS_TRAIL_MAX_POINTS}; i++) {
          if (i >= uTrailCount) break;
          vec4 trailA = uTrail[i - 1];
          vec4 trailB = uTrail[i];
          vec2 trailSegment = trailB.xy - trailA.xy;
          float trailSegmentLengthSq = max(dot(trailSegment, trailSegment), 0.0001);
          float trailT = clamp(
            dot(grassRootWorld.xy - trailA.xy, trailSegment) / trailSegmentLengthSq,
            0.0,
            1.0
          );
          float trailDistance = distance(
            grassRootWorld.xy,
            trailA.xy + trailSegment * trailT
          );
          float trailFade = mix(trailA.z, trailB.z, trailT);
          float trailCoverage =
            (1.0 - smoothstep(0.0, 10.0, trailDistance)) * trailFade;
          trailFlatten = max(trailFlatten, trailCoverage);
          trailBendVec +=
            trailSegment * inversesqrt(trailSegmentLengthSq) * trailCoverage;
        }
        vec2 trailBendDir =
          dot(trailBendVec, trailBendVec) > 1e-6
            ? normalize(trailBendVec)
            : vec2(0.0);

        float grassFlatten = clamp(
          max(grassFlattenFromShadow, trailFlatten * 0.85),
          0.0,
          1.0
        );

        // Splay blades out of the tuft under the body, and lay the residual
        // trail along the direction the tail travelled. A radial direction
        // alone would look like a hole; the trail direction makes it a path.
        vec2 grassBladeOffsetWorld = position.xy;
        #ifdef USE_INSTANCING
          grassBladeOffsetWorld = mat2(instanceMatrix[0].xy, instanceMatrix[1].xy) * position.xy;
        #endif
        vec2 grassSplayDir = normalize(grassBladeOffsetWorld + vec2(0.001, 0.001));
        vec2 grassBendVec =
          grassSplayDir * (grassFlattenFromShadow * 0.9) +
          trailBendDir * trailFlatten;
        vec2 grassBendDir =
          dot(grassBendVec, grassBendVec) > 1e-6
            ? normalize(grassBendVec)
            : grassSplayDir;

        // Lay the blade over instead of only shrinking it. The tip travels
        // almost a full blade height along the bend direction, while the root
        // stays anchored, which reads as crushed grass from the game camera.
        transformed.z *= 1.0 - 0.94 * grassFlatten;

        vec2 grassBendDirLocal = grassBendDir;
        #ifdef USE_INSTANCING
          vec2 grassRotX = normalize(instanceMatrix[0].xy);
          vec2 grassRotY = normalize(instanceMatrix[1].xy);
          grassBendDirLocal = vec2(
            dot(grassBendDir, grassRotX),
            dot(grassBendDir, grassRotY)
          );
        #endif
        transformed.xy += grassBendDirLocal * (position.z * grassFlatten);

        vec4 mvPosition = vec4( transformed, 1.0 );

        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif

        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif

        // GoT's wind is one global direction with a time-varying Perlin
        // magnitude, not a per-tuft random wobble. Here the magnitude is
        // advected anisotropic noise: long waves along the flow and short
        // waves across it, so gusts visibly travel across the meadow. A slow
        // turn and a fast per-blade flutter keep the mass from looking frozen.
        float windAngle =
          0.62 + 0.20 * sin(uTime * 0.11) + 0.10 * sin(uTime * 0.037 + 2.1);
        vec2 grassWindDir = vec2(cos(windAngle), sin(windAngle));
        vec2 grassWindSideDir = vec2(-grassWindDir.y, grassWindDir.x);
        float windAlong = dot(grassRootWorld.xy, grassWindDir);
        float windAcross = dot(grassRootWorld.xy, grassWindSideDir);

        float gustLarge = grassFbm(vec2(
          windAlong * 0.011 - uTime * 0.55,
          windAcross * 0.045
        ));
        float gustSmall = grassFbm(vec2(
          windAlong * 0.040 - uTime * 1.60,
          windAcross * 0.130
        ) + vec2(13.7, 5.1));
        float gust = smoothstep(
          0.22,
          0.82,
          gustLarge * 0.62 + gustSmall * 0.38
        );
        float gustFront = smoothstep(0.46, 0.72, gustLarge);
        float grassWindAmp =
          (1.2 + 4.2 * gust * (0.55 + 0.45 * gustFront)) * uWindStrength;

        float windTurn =
          (grassValueNoise(grassRootWorld.xy * 0.012 - vec2(uTime * 0.05, 0.0)) - 0.5);
        vec2 grassWind = normalize(grassWindDir + grassWindSideDir * windTurn * 0.8);
        float crossWave =
          sin(windAcross * 0.09 - uTime * 2.2 + gustLarge * 6.283);
        grassWind = normalize(grassWind + grassWindSideDir * crossWave * 0.16);

        float tuftPhase = grassHash21(grassRootWorld.xy * 0.71 + 4.3);
        float flutter =
          sin(
            uTime * (5.2 + tuftPhase * 2.2) +
            tuftPhase * 19.0 +
            windAlong * 0.22 +
            position.x * 0.8
          ) * (0.08 + 0.24 * gust);
        float shimmer =
          sin(
            uTime * (9.0 + tuftPhase * 3.0) +
            tuftPhase * 41.0 +
            windAcross * 0.45
          ) * (0.03 + 0.08 * gust);

        // Crushed blades stay down instead of springing back with the gust.
        float grassWindScale = 1.0 - 0.8 * grassFlatten;
        mvPosition.xy += grassWind * grassWindAmp * grassBend * grassWindScale;
        mvPosition.xy +=
          grassWindSideDir * (flutter + shimmer) * grassBend * uWindStrength * grassWindScale;

        vec4 grassWorld = modelMatrix * mvPosition;
        vec2 grassToPlayer = grassWorld.xy - uPlayerPos;
        float grassDist = length(grassToPlayer);
        // The head parts the grass only in its immediate neighbourhood; the
        // ribbon shadow handles the rest of the body.
        float grassPush = (1.0 - smoothstep(10.0, 28.0, grassDist)) * grassBend * 1.8;
        mvPosition.xy += (grassToPlayer / max(grassDist, 0.001)) * grassPush;

        vGrassShadow =
          clamp(shadowCoverage * 1.6, 0.0, 1.0) * uShadowStrength;
        vGrassTrail = clamp(trailFlatten * 0.85, 0.0, 1.0);

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
      varying float vGrassTrail;
      uniform vec3 uShadowTint;
      uniform vec3 uTrailTint;
      ${shader.fragmentShader}`;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(1.0), uShadowTint, vGrassShadow);
        diffuseColor.rgb *= mix(vec3(1.0), uTrailTint, vGrassTrail);
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
