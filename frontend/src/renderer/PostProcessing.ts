// ROLE: EffectComposer-пайплайн: tone mapping, SSAO без overlay-слоя, bloom, линзирование ЧД и atmosphere grade.

import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  SSAOEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import * as THREE from "three";
import { gridSize } from "../game/Config";
import { AtmosphereEffect } from "./AtmosphereEffect";

const lensingFragmentShader = `
  uniform vec3 uBlackHoles[10];
  uniform int uBlackHoleCount;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 totalDistortion = vec2(0.0);

    for (int i = 0; i < 10; i++) {
      if (i >= uBlackHoleCount) break;
      vec2 bhScreen = uBlackHoles[i].xy;
      float pullRadius = uBlackHoles[i].z;

      vec2 toBH = bhScreen - uv;
      float dist = length(toBH);
      if (dist < pullRadius && dist > 0.001) {
        float force = (pullRadius - dist) / pullRadius;
        float warpStrength = pow(force, 2.5) * 0.08 * pullRadius;
        totalDistortion += normalize(toBH) * warpStrength;
      }
    }

    outputColor = texture2D(inputBuffer, uv - totalDistortion);
  }
`;

class LensingEffect extends Effect {
  constructor(options: any = {}) {
    super("LensingEffect", lensingFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, any>([
        ["uBlackHoles", new THREE.Uniform(options.bhPositionsArray || new Float32Array(30))],
        ["uBlackHoleCount", new THREE.Uniform(0)],
      ]),
    });
  }
}

/**
 * The fog, head glow and boost particles live on OVERLAY_LAYER. They must not
 * write into the normal buffer, otherwise a full-screen fog plane overwrites
 * every normal and SSAO sees a flat surface.
 */
class BaseLayerNormalPass extends NormalPass {
  private readonly cameraRef: THREE.PerspectiveCamera;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    super(scene, camera);
    this.cameraRef = camera;
  }

  public render(
    renderer: THREE.WebGLRenderer,
    inputBuffer: THREE.WebGLRenderTarget | null,
    outputBuffer: THREE.WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean,
  ): void {
    const mask = this.cameraRef.layers.mask;
    this.cameraRef.layers.set(0);
    try {
      super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest);
    } finally {
      this.cameraRef.layers.mask = mask;
    }
  }
}

export interface PostProcessingOptions {
  ssao?: boolean;
  bloom?: boolean;
}

export class PostProcessing {
  private readonly composer: EffectComposer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private lensingEffect!: LensingEffect;
  private atmosphereEffect!: AtmosphereEffect;
  private ssaoEnabled: boolean;
  private bloomEnabled: boolean;
  private pipelineReady = false;

  private bhPositionsArray = new Float32Array(30);
  private tempVec3 = new THREE.Vector3();
  private tempProjected = new THREE.Vector3();

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    options: PostProcessingOptions = {},
  ) {
    this.scene = scene;
    this.camera = camera;
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.ssaoEnabled = options.ssao ?? true;
    this.bloomEnabled = options.bloom ?? true;

    this.buildPipeline();
    this.pipelineReady = true;
    this.resize(width, height);
  }

  /** Rebuild passes in place. Keeps the composer buffers and shared fullscreen geometry alive. */
  public setOptions(options: PostProcessingOptions): void {
    const ssao = options.ssao ?? true;
    const bloom = options.bloom ?? true;
    if (this.pipelineReady && ssao === this.ssaoEnabled && bloom === this.bloomEnabled) return;

    this.ssaoEnabled = ssao;
    this.bloomEnabled = bloom;

    const oldPasses = [...this.composer.passes];
    this.composer.removeAllPasses();
    for (const pass of oldPasses) pass.dispose();

    this.pipelineReady = false;
    this.buildPipeline();
    this.pipelineReady = true;
  }

  private buildPipeline(): void {
    const useSsao = this.ssaoEnabled;
    const useBloom = this.bloomEnabled;
    const baseEffects: Effect[] = [];

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (useSsao) {
      const normalPass = new BaseLayerNormalPass(this.scene, this.camera);
      this.composer.addPass(normalPass);
      baseEffects.push(
        new SSAOEffect(this.camera, normalPass.texture, {
          intensity: 1.5,
          radius: 0.05,
          samples: 16,
          rings: 4,
          distanceScaling: true,
          distanceThreshold: 0.5,
          distanceFalloff: 0.1,
        }),
      );
    }

    if (useBloom) {
      baseEffects.push(
        new BloomEffect({
          intensity: 1.1,
          // Low effective threshold so saturated body colors bloom; the
          // selection-less bloom is kept cheap and only affects bright pixels.
          luminanceThreshold: 0.18,
          luminanceSmoothing: 0.2,
          // A tighter mipmap radius keeps the body halo readable instead of
          // turning the whole screen into a green fog.
          radius: 0.45,
          // Mipmap blur is both smoother and cheaper than many tap passes.
          mipmapBlur: true,
        }),
      );
    }

    baseEffects.push(
      new ToneMappingEffect({
        mode: ToneMappingMode.ACES_FILMIC,
      }),
    );
    this.composer.addPass(new EffectPass(this.camera, ...baseEffects));

    // Lensing samples the input buffer to distort the image. It must live in a
    // separate pass, after bloom/tonemapping, otherwise it overwrites them.
    this.lensingEffect = new LensingEffect({ bhPositionsArray: this.bhPositionsArray });
    this.atmosphereEffect = new AtmosphereEffect();
    this.composer.addPass(new EffectPass(this.camera, this.lensingEffect, this.atmosphereEffect));
  }

  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public destroy(): void {
    this.composer.dispose();
  }

  public render(_scene: THREE.Scene, camera: THREE.PerspectiveCamera, msg: any): boolean {
    // Lensing projects world points with the camera matrices, so refresh them
    // before building the uniform array instead of after.
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const state = msg?.gameState;
    let bhCount = 0;

    if (state?.black_holes && state.black_holes.length > 0) {
      bhCount = this.computeLensingUniforms(state.black_holes, camera);
    }

    this.lensingEffect.uniforms.get("uBlackHoleCount")!.value = bhCount;

    this.composer.render();
    return true; // Tone mapping and black-hole lensing always use the composer.
  }

  private computeLensingUniforms(blackHoles: any[], camera: THREE.PerspectiveCamera): number {
    let bhCount = 0;
    const numBH = Math.min(blackHoles.length, 10);

    for (let i = 0; i < numBH; i++) {
      const bh = blackHoles[i];
      if (!bh) continue;

      const pullRadius = bh.pull_radius || 0.0;
      const worldX = bh.x * gridSize + gridSize / 2.0;
      const worldY = -(bh.y * gridSize + gridSize / 2.0);
      const bhZ = 0.9;

      // Camera space check (dist to camera plane)
      this.tempVec3.set(worldX, worldY, bhZ).applyMatrix4(camera.matrixWorldInverse);
      const distToCamPlane = -this.tempVec3.z;

      if (distToCamPlane <= camera.near) continue;

      // Fade out close to near plane
      const fadeStart = camera.near * 2.5;
      const fadeFactor =
        distToCamPlane < fadeStart
          ? Math.max(0.0, (distToCamPlane - camera.near) / (fadeStart - camera.near))
          : 1.0;

      const effectivePullRadius = pullRadius * fadeFactor;
      if (effectivePullRadius <= 0.001) continue;

      // Project world center to Screen UV [0, 1]
      this.tempVec3.set(worldX, worldY, bhZ).project(camera);
      const screenX = this.tempVec3.x * 0.5 + 0.5;
      const screenY = this.tempVec3.y * 0.5 + 0.5;

      // Project edge point
      this.tempProjected.set(worldX + effectivePullRadius * gridSize, worldY, bhZ).project(camera);
      const screenEdgeX = this.tempProjected.x * 0.5 + 0.5;
      const screenPullRadius = Math.min(Math.abs(screenEdgeX - screenX), 0.35);

      const idx = bhCount * 3;
      this.bhPositionsArray[idx + 0] = screenX;
      this.bhPositionsArray[idx + 1] = screenY;
      this.bhPositionsArray[idx + 2] = screenPullRadius;
      bhCount++;
    }

    return bhCount;
  }
}
