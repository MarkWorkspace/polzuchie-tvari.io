// ROLE: One instanced draw for decor stones: preallocated mesh, baked-variant
// shader, stone pairing and the shared decor rebuild throttle. Purely visual:
// no collision, no gameplay, no server knowledge, no shadows, no bloom mask.

import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import {
  createDecorPropBuffer,
  DECOR_BUDGET_CAPS,
  type DecorPropBuffer,
  GRASS_CELL_DENSITY,
  GRASS_SEED,
  type GrassFieldConfig,
  placeDecorProps,
  toroidalDelta,
} from "./DecorField";
import { DecorUpdateGate, type DecorViewState } from "./DecorUpdateGate";
import { grassCullRadius, grassLodScale } from "./GrassRenderer";
import { createStoneGeometry } from "./PropGeometry";
import { RenderConfig, RenderLayer } from "./RenderConfig";

/** Stones sit on the ground plane; their geometry is authored half-buried. */
export const PROP_GROUND_Z = -2.0;
const FALLBACK_FOG_RADIUS = 900;

/** Stones grow with the camera much less than grass: they stay pebbles, not boulders. */
export const PROP_LOD_STRENGTH = 0.06;

export function propLodScale(grassScale: number): number {
  const scale = Number.isFinite(grassScale) && grassScale > 0 ? grassScale : 1;
  return 1 + (scale - 1) * PROP_LOD_STRENGTH;
}

interface OccupiedDisc {
  x: number;
  y: number;
  radius: number;
}

/** Stones are authored around radius 1, so the instance scale is their footprint radius. */
const STONE_FOOTPRINT_RADIUS = 1;

/** Allowed overlap as a share of the combined footprint; a little is natural, a lot is not. */
const STONE_OVERLAP_SHARE = 0.62;

const STONE_SHADE = new THREE.Color(0xeef1f3);
const STONE_LIGHT = new THREE.Color(0xffffff);

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class PropRenderer {
  private readonly scene: THREE.Scene;
  private readonly mesh: THREE.InstancedMesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly buffer: DecorPropBuffer;
  private readonly variantAttribute: THREE.InstancedBufferAttribute;
  private readonly fieldConfig: GrassFieldConfig;
  private readonly gate = new DecorUpdateGate();
  private readonly occupied: OccupiedDisc[] = [];
  private readonly scratchColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const capacity = DECOR_BUDGET_CAPS.stones;
    this.buffer = createDecorPropBuffer(capacity);
    this.fieldConfig = {
      seed: GRASS_SEED,
      gridSize,
      mapCellsX: WORLD_WIDTH,
      mapCellsY: WORLD_HEIGHT,
      density: GRASS_CELL_DENSITY,
    };

    const geometry = createStoneGeometry();
    this.variantAttribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.variantAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aInstanceVariant", this.variantAttribute);

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    this.patchVariantShader(this.material);

    this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
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
    stoneBudget: number,
    nowMs: number,
    targetX: number,
    targetY: number,
    viewHalfExtent: number,
  ): void {
    const camX = finiteOr(targetX, finiteOr(frame?.camX, 0));
    const camY = finiteOr(targetY, finiteOr(frame?.camY, 0));
    const requested = Number.isFinite(stoneBudget) ? Math.max(0, Math.floor(stoneBudget)) : 0;
    const stones = Math.min(requested, DECOR_BUDGET_CAPS.stones);

    if (stones <= 0) {
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
    const lodScale = propLodScale(grassLodScale(viewHalfExtent));

    const state: DecorViewState = {
      nowMs,
      camX,
      camY,
      mapX,
      mapY,
      budget: stones,
      cullRadius,
      viewExtent: viewHalfExtent,
    };
    if (!this.gate.shouldRebuild(state)) return;

    this.fieldConfig.mapCellsX = mapX;
    this.fieldConfig.mapCellsY = mapY;
    this.occupied.length = 0;

    const count = placeDecorProps(
      "stone",
      camX,
      camY,
      cullRadius,
      stones,
      this.fieldConfig,
      this.buffer,
    );
    const written = this.writeInstances(count, lodScale, mapX * gridSize, mapY * gridSize);

    this.mesh.count = written;
    this.mesh.visible = written > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.variantAttribute.needsUpdate = true;
    this.gate.markBuilt(state);
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.instanceMatrix.dispose();
    this.mesh.instanceColor?.dispose();
    this.material.dispose();
  }

  private patchVariantShader(material: THREE.MeshStandardMaterial): void {
    // Every stone silhouette is baked into one geometry; each instance collapses
    // the variants it did not pick, so three silhouettes still mean one draw call.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float aVariant;
attribute float aInstanceVariant;
${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      if (abs(aVariant - aInstanceVariant) > 0.5) {
        transformed = vec3(0.0);
      }`,
      );
    };
  }

  private writeInstances(
    count: number,
    lodScale: number,
    worldWidth: number,
    worldHeight: number,
  ): number {
    const matrices = this.mesh.instanceMatrix.array as Float32Array;
    const colors = this.mesh.instanceColor?.array as Float32Array | undefined;
    const variants = this.variantAttribute.array as Float32Array;
    const { x, y, yaw, scale, variant, colorMix } = this.buffer;
    let written = 0;

    for (let i = 0; i < count; i++) {
      const worldRadius = scale[i] * STONE_FOOTPRINT_RADIUS;
      if (this.overlapsExisting(x[i], y[i], worldRadius, worldWidth, worldHeight)) {
        continue;
      }

      // Compact accepted instances in place so the mesh draws a contiguous range.
      if (written !== i) {
        x[written] = x[i];
        y[written] = y[i];
        yaw[written] = yaw[i];
        scale[written] = scale[i];
        variant[written] = variant[i];
        colorMix[written] = colorMix[i];
      }

      const o = written * 16;
      const s = scale[written] * lodScale;
      const cos = Math.cos(yaw[written]) * s;
      const sin = Math.sin(yaw[written]) * s;

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
      matrices[o + 12] = x[written];
      matrices[o + 13] = y[written];
      matrices[o + 14] = PROP_GROUND_Z;
      matrices[o + 15] = 1;

      variants[written] = variant[written];

      if (colors) {
        const c = this.scratchColor.lerpColors(STONE_SHADE, STONE_LIGHT, colorMix[written]);
        colors[written * 3] = c.r;
        colors[written * 3 + 1] = c.g;
        colors[written * 3 + 2] = c.b;
      }

      this.occupied.push({ x: x[written], y: y[written], radius: worldRadius });
      written++;
    }

    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, written * 16);
    this.variantAttribute.clearUpdateRanges();
    this.variantAttribute.addUpdateRange(0, written);
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.clearUpdateRanges();
      this.mesh.instanceColor.addUpdateRange(0, written * 3);
    }
    return written;
  }

  private overlapsExisting(
    x: number,
    y: number,
    radius: number,
    worldWidth: number,
    worldHeight: number,
  ): boolean {
    for (const other of this.occupied) {
      const limit = (other.radius + radius) * STONE_OVERLAP_SHARE;
      const dx = toroidalDelta(x - other.x, worldWidth);
      const dy = toroidalDelta(y - other.y, worldHeight);
      if (dx * dx + dy * dy < limit * limit) return true;
    }
    return false;
  }
}
