// ROLE: One instanced draw per decor prop family (stones, bones, mushrooms): preallocated meshes,
// baked-variant shader and the shared decor rebuild throttle. Purely visual: no collision,
// no gameplay, no server knowledge, no shadows, no bloom-mask participation.

import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import {
  createDecorPropBuffer,
  DECOR_BUDGET_CAPS,
  type DecorPropBuffer,
  type DecorPropType,
  GRASS_CELL_DENSITY,
  GRASS_SEED,
  type GrassFieldConfig,
  placeDecorProps,
  splitDecorBudget,
  toroidalDelta,
} from "./DecorField";
import { DecorUpdateGate, type DecorViewState } from "./DecorUpdateGate";
import { grassCullRadius, grassLodScale } from "./GrassRenderer";
import { createPropGeometry } from "./PropGeometry";
import { RenderConfig, RenderLayer } from "./RenderConfig";

/** Props sit a hair below the grass roots so they read as part of the ground. */
export const PROP_GROUND_Z = -1.97;
const FALLBACK_FOG_RADIUS = 900;

/** Props grow with the camera much less than grass: they stay landmarks, not boulders. */
export const PROP_LOD_STRENGTH = 0.06;

export function propLodScale(grassScale: number): number {
  const scale = Number.isFinite(grassScale) && grassScale > 0 ? grassScale : 1;
  return 1 + (scale - 1) * PROP_LOD_STRENGTH;
}

interface FamilySpec {
  type: DecorPropType;
  budgetKey: "stones" | "bones" | "mushrooms";
  cap: number;
  shade: number;
  light: number;
}

const FAMILIES: readonly FamilySpec[] = [
  {
    type: "stone",
    budgetKey: "stones",
    cap: DECOR_BUDGET_CAPS.stones,
    shade: 0xeef1f3,
    light: 0xffffff,
  },
  {
    type: "bone",
    budgetKey: "bones",
    cap: DECOR_BUDGET_CAPS.bones,
    shade: 0xf4efe4,
    light: 0xffffff,
  },
  {
    type: "mushroom",
    budgetKey: "mushrooms",
    cap: DECOR_BUDGET_CAPS.mushrooms,
    shade: 0xf2e7dd,
    light: 0xffffff,
  },
];

interface FamilyRuntime {
  spec: FamilySpec;
  mesh: THREE.InstancedMesh;
  material: THREE.MeshStandardMaterial;
  buffer: DecorPropBuffer;
  variantAttribute: THREE.InstancedBufferAttribute;
  shade: THREE.Color;
  light: THREE.Color;
}

interface OccupiedDisc {
  x: number;
  y: number;
  radius: number;
}

/** Footprint radius of one instance, in world units (geometry is authored around radius 1). */
const FOOTPRINT_RADIUS: Record<DecorPropType, number> = {
  stone: 1,
  bone: 0.9,
  mushroom: 0.95,
};

/** Allowed overlap as a share of the combined footprint; a little is natural, a lot is not. */
const PROP_OVERLAP_SHARE = 0.62;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createFamily(spec: FamilySpec): FamilyRuntime {
  const geometry = createPropGeometry(spec.type);
  const variantAttribute = new THREE.InstancedBufferAttribute(new Float32Array(spec.cap), 1);
  variantAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("aInstanceVariant", variantAttribute);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    // Thin ribs and open mushroom caps look correct from every camera tilt.
    side: THREE.DoubleSide,
  });

  // Every family bakes several silhouettes into one geometry; instances collapse
  // the variants they did not pick, so one mesh still means one draw call.
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

  const mesh = new THREE.InstancedMesh(geometry, material, spec.cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(spec.cap * 3), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  RenderConfig.configureMesh(mesh, RenderLayer.Opaque, {
    castShadow: false,
    receiveShadow: false,
    frustumCulled: false,
  });
  mesh.count = 0;
  mesh.visible = false;

  return {
    spec,
    mesh,
    material,
    buffer: createDecorPropBuffer(spec.cap),
    variantAttribute,
    shade: new THREE.Color(spec.shade),
    light: new THREE.Color(spec.light),
  };
}

export class PropRenderer {
  private readonly scene: THREE.Scene;
  private readonly families: FamilyRuntime[];
  private readonly fieldConfig: GrassFieldConfig;
  private readonly gate = new DecorUpdateGate();
  private readonly occupied: OccupiedDisc[] = [];
  private readonly scratchColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.families = FAMILIES.map(createFamily);
    this.fieldConfig = {
      seed: GRASS_SEED,
      gridSize,
      mapCellsX: WORLD_WIDTH,
      mapCellsY: WORLD_HEIGHT,
      density: GRASS_CELL_DENSITY,
    };

    for (const family of this.families) this.scene.add(family.mesh);
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
    const split = splitDecorBudget(budget);
    const propBudget = split.stones + split.bones + split.mushrooms;

    if (propBudget <= 0) {
      for (const family of this.families) {
        family.mesh.count = 0;
        family.mesh.visible = false;
      }
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
      budget,
      cullRadius,
      viewExtent: viewHalfExtent,
    };
    if (!this.gate.shouldRebuild(state)) return;

    this.fieldConfig.mapCellsX = mapX;
    this.fieldConfig.mapCellsY = mapY;
    this.occupied.length = 0;
    const worldWidth = mapX * gridSize;
    const worldHeight = mapY * gridSize;

    for (const family of this.families) {
      const count = placeDecorProps(
        family.spec.type,
        camX,
        camY,
        cullRadius,
        split[family.spec.budgetKey],
        this.fieldConfig,
        family.buffer,
      );
      const written = this.writeInstances(family, count, lodScale, worldWidth, worldHeight);
      family.mesh.count = written;
      family.mesh.visible = written > 0;
      family.mesh.instanceMatrix.needsUpdate = true;
      if (family.mesh.instanceColor) family.mesh.instanceColor.needsUpdate = true;
      family.variantAttribute.needsUpdate = true;
    }

    this.gate.markBuilt(state);
  }

  public destroy(): void {
    for (const family of this.families) {
      this.scene.remove(family.mesh);
      family.mesh.geometry.dispose();
      family.mesh.instanceMatrix.dispose();
      family.mesh.instanceColor?.dispose();
      family.material.dispose();
    }
  }

  private writeInstances(
    family: FamilyRuntime,
    count: number,
    lodScale: number,
    worldWidth: number,
    worldHeight: number,
  ): number {
    const matrices = family.mesh.instanceMatrix.array as Float32Array;
    const colors = family.mesh.instanceColor?.array as Float32Array | undefined;
    const variants = family.variantAttribute.array as Float32Array;
    const { x, y, yaw, scale, variant, colorMix } = family.buffer;
    const footprint = FOOTPRINT_RADIUS[family.spec.type];
    let written = 0;

    for (let i = 0; i < count; i++) {
      const worldRadius = scale[i] * footprint;
      if (this.overlapsExisting(x[i], y[i], worldRadius, worldWidth, worldHeight)) {
        // Stones win over bones and mushrooms: a cap must not grow out of a rock.
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
        const c = this.scratchColor.lerpColors(family.shade, family.light, colorMix[written]);
        colors[written * 3] = c.r;
        colors[written * 3 + 1] = c.g;
        colors[written * 3 + 2] = c.b;
      }

      this.occupied.push({ x: x[written], y: y[written], radius: worldRadius });
      written++;
    }

    family.mesh.instanceMatrix.clearUpdateRanges();
    family.mesh.instanceMatrix.addUpdateRange(0, written * 16);
    family.variantAttribute.clearUpdateRanges();
    family.variantAttribute.addUpdateRange(0, written);
    if (family.mesh.instanceColor) {
      family.mesh.instanceColor.clearUpdateRanges();
      family.mesh.instanceColor.addUpdateRange(0, written * 3);
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
      const limit = (other.radius + radius) * PROP_OVERLAP_SHARE;
      const dx = toroidalDelta(x - other.x, worldWidth);
      const dy = toroidalDelta(y - other.y, worldHeight);
      if (dx * dx + dy * dy < limit * limit) return true;
    }
    return false;
  }
}
