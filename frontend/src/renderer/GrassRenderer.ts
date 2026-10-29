// ROLE: One-instance-draw decorative grass field: geometry, material, wind shader and rebuild throttle.
// Purely visual: no collision, no gameplay, no server knowledge.

import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import {
  createGrassTuftBuffer,
  DECOR_BUDGET_CAPS,
  GRASS_CELL_DENSITY,
  GRASS_SEED,
  type GrassFieldConfig,
  type GrassTuftBuffer,
  placeGrassTufts,
  splitDecorBudget,
} from "./DecorField";
import { DecorUpdateGate, type DecorViewState } from "./DecorUpdateGate";
import { RenderConfig, RenderLayer } from "./RenderConfig";

const MAX_INSTANCES = DECOR_BUDGET_CAPS.grass;
const FALLBACK_FOG_RADIUS = 900;
export const GRASS_GROUND_Z = -1.9;
const GRASS_PUSH_DISABLED = 1e6;

/** The field always covers at least this radius so a close camera keeps a stable field. */
export const GRASS_MIN_CULL_RADIUS = 550;
/** Cap for the cull radius: a fixed instance budget cannot cover more without turning to dust. */
export const GRASS_MAX_CULL_RADIUS = 1200;
/** Tuft scale cap for far cameras, so the field stays legible in the overview. */
export const GRASS_LOD_SCALE_MAX = 2.6;
/** View half-extent (world units) at which tufts reach their maximum LOD scale. */
export const GRASS_LOD_EXTENT = 300;

const BLADE_HEIGHT = 6.5;
const BLADE_BASE_WIDTH = 2.35;
const BLADE_TIP_WIDTH = 0.82;
const BLADE_COUNT = 3;

// Base-to-tip shade. Multiplied by the per-instance colour.
const VERTEX_SHADE_BASE = 0.55;
const VERTEX_SHADE_MID = 0.86;
const VERTEX_SHADE_TIP = 1.0;

const SHADE_COLOR = 0x616b44;
const LIGHT_COLOR = 0x8b9065;

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

  const bladeAngles = [0.4, 1.45, 2.35];
  const bladeHeights = [0.82, 1.0, 0.92];
  const bladeOffsets = [0.4, 1.0, 0.7];
  const bladeLeans = [1.2, 1.9, 1.5];

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
    // from every camera heading instead of half the blades going black.
    for (let i = 0; i < 5; i++) normals.push(0, 0, 1);

    colors.push(
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_BASE,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_MID,
      VERTEX_SHADE_TIP,
      VERTEX_SHADE_TIP,
      VERTEX_SHADE_TIP,
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

export class GrassRenderer {
  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly tufts: GrassTuftBuffer;
  private readonly fieldConfig: GrassFieldConfig;
  private readonly uniforms = {
    uTime: { value: 0 },
    uPlayerPos: { value: new THREE.Vector2() },
  };
  private readonly shadeColor = new THREE.Color(SHADE_COLOR);
  private readonly lightColor = new THREE.Color(LIGHT_COLOR);
  private readonly scratchColor = new THREE.Color();
  private readonly gate = new DecorUpdateGate();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.tufts = createGrassTuftBuffer(MAX_INSTANCES);
    this.fieldConfig = {
      seed: GRASS_SEED,
      gridSize,
      mapCellsX: WORLD_WIDTH,
      mapCellsY: WORLD_HEIGHT,
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
  }

  public update(
    frame: any,
    budget: number,
    nowMs: number,
    targetX: number,
    targetY: number,
    viewHalfExtent: number,
  ): void {
    const camX = finiteOr(targetX, finiteOr(frame?.camX, 0));
    const camY = finiteOr(targetY, finiteOr(frame?.camY, 0));
    const isSpectator = frame?.myId === "spectator_id";
    const pushX = isSpectator ? GRASS_PUSH_DISABLED : finiteOr(frame?.camX, camX);
    const pushY = isSpectator ? GRASS_PUSH_DISABLED : finiteOr(frame?.camY, camY);
    this.uniforms.uTime.value = nowMs * 0.001;
    this.uniforms.uPlayerPos.value.set(pushX, pushY);

    const instanceBudget = splitDecorBudget(budget).grass;
    if (instanceBudget <= 0) {
      this.mesh.count = 0;
      this.mesh.visible = false;
      this.gate.invalidate();
      return;
    }

    const mapX = Math.max(1, Math.floor(frame?.gameState?.server_world?.width ?? WORLD_WIDTH));
    const mapY = Math.max(1, Math.floor(frame?.gameState?.server_world?.height ?? WORLD_HEIGHT));

    const fogRadius =
      Number.isFinite(frame?.fogRadiusWorld) && frame.fogRadiusWorld > 0
        ? frame.fogRadiusWorld
        : FALLBACK_FOG_RADIUS;
    const cullRadius = grassCullRadius(fogRadius, viewHalfExtent);
    const lodScale = grassLodScale(viewHalfExtent);

    const state: DecorViewState = {
      nowMs,
      camX,
      camY,
      mapX,
      mapY,
      budget: instanceBudget,
      cullRadius,
      viewExtent: viewHalfExtent,
    };
    if (!this.gate.shouldRebuild(state)) return;

    this.rebuild(instanceBudget, mapX, mapY, camX, camY, cullRadius, lodScale);
    this.gate.markBuilt(state);
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.instanceMatrix.dispose();
    this.material.dispose();
    this.mesh.instanceColor?.dispose();
  }

  private rebuild(
    budget: number,
    mapX: number,
    mapY: number,
    camX: number,
    camY: number,
    cullRadius: number,
    lodScale: number,
  ): void {
    this.fieldConfig.mapCellsX = mapX;
    this.fieldConfig.mapCellsY = mapY;

    const count = placeGrassTufts(camX, camY, cullRadius, budget, this.fieldConfig, this.tufts);
    this.writeInstances(count, lodScale);

    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
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
      shader.uniforms.uPlayerPos = this.uniforms.uPlayerPos;

      shader.vertexShader = `
        uniform float uTime;
        uniform vec2 uPlayerPos;
        float grassBend = 0.0;
      ${shader.vertexShader}`;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>

        float grassT = clamp(position.z / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
        grassBend = grassT * grassT;
        #ifdef USE_INSTANCING
          float grassPhase = instanceMatrix[3].x * 0.043 + instanceMatrix[3].y * 0.031;
        #else
          float grassPhase = 0.0;
        #endif
        float grassGust = sin(uTime * 0.9 + grassPhase) * 0.6
          + sin(uTime * 2.3 + grassPhase * 1.7) * 0.2;
        transformed.x += grassGust * grassBend * 1.2;
        transformed.y += grassGust * grassBend * 0.4;
        `,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4( transformed, 1.0 );

        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif

        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif

        vec4 grassWorld = modelMatrix * mvPosition;
        vec2 grassToPlayer = grassWorld.xy - uPlayerPos;
        float grassDist = length(grassToPlayer);
        float grassPush = (1.0 - smoothstep(10.0, 150.0, grassDist)) * grassBend * 2.0;
        mvPosition.xy += (grassToPlayer / max(grassDist, 0.001)) * grassPush;

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
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
