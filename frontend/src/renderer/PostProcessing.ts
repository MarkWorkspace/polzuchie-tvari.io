// ROLE: Линзирование, AO, туман.
import * as THREE from "three";
import { EffectComposer, RenderPass, EffectPass, SSAOEffect, NormalPass, Effect, BlendFunction, EffectAttribute } from "postprocessing";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from "../game/Config";

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
    super('LensingEffect', lensingFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, any>([
        ['uBlackHoles', new THREE.Uniform(options.bhPositionsArray || new Float32Array(30))],
        ['uBlackHoleCount', new THREE.Uniform(0)]
      ])
    });
  }
}

const radialFogFragmentShader = `
  uniform vec2 uHeadWorldPos;
  uniform float uRadiusWorld;
  uniform vec2 uWorldSize;
  uniform mat4 uCameraMatrixWorld;
  uniform mat4 uProjectionMatrixInverse;
  uniform vec3 uFogColor;

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    if (depth >= 0.99999) {
      outputColor = vec4(uFogColor, 1.0);
      return;
    }

    vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 viewPos = uProjectionMatrixInverse * ndc;
    viewPos /= viewPos.w;
    vec4 worldPos = uCameraMatrixWorld * viewPos;

    float dx = worldPos.x - uHeadWorldPos.x;
    float dy = worldPos.y - uHeadWorldPos.y;

    if (dx > uWorldSize.x / 2.0) dx -= uWorldSize.x;
    else if (dx < -uWorldSize.x / 2.0) dx += uWorldSize.x;

    if (dy > uWorldSize.y / 2.0) dy -= uWorldSize.y;
    else if (dy < -uWorldSize.y / 2.0) dy += uWorldSize.y;

    float dist = sqrt(dx * dx + dy * dy);
    float start = uRadiusWorld * 0.70;
    float end = uRadiusWorld * 1.0;
    float fogAmount = smoothstep(start, end, dist);

    outputColor = vec4(mix(inputColor.rgb, uFogColor, fogAmount), 1.0);
  }
`;

class RadialFogEffect extends Effect {
  constructor() {
    super('RadialFogEffect', radialFogFragmentShader, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, any>([
        ['uHeadWorldPos', new THREE.Uniform(new THREE.Vector2(0, 0))],
        ['uRadiusWorld', new THREE.Uniform(300.0)],
        ['uWorldSize', new THREE.Uniform(new THREE.Vector2(2000, 2000))],
        ['uCameraMatrixWorld', new THREE.Uniform(new THREE.Matrix4())],
        ['uProjectionMatrixInverse', new THREE.Uniform(new THREE.Matrix4())],
        ['uFogColor', new THREE.Uniform(new THREE.Color(12 / 255, 12 / 255, 15 / 255))]
      ])
    });
  }
}

export class PostProcessing {
  private composer: EffectComposer;
  private lensingEffect: LensingEffect;
  private radialFogEffect: RadialFogEffect;
  private normalPass: NormalPass;

  private bhPositionsArray = new Float32Array(30);
  private tempVec3 = new THREE.Vector3();
  private tempProjected = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, width: number, height: number) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType
    });

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    this.normalPass = new NormalPass(scene, camera);
    this.composer.addPass(this.normalPass);

    const ssaoEffect = new SSAOEffect(camera, this.normalPass.texture, {
      intensity: 1.5,
      radius: 0.05,
      samples: 16,
      rings: 4,
      distanceScaling: true,
      distanceThreshold: 0.5,
      distanceFalloff: 0.1
    });

    this.lensingEffect = new LensingEffect({ bhPositionsArray: this.bhPositionsArray });
    this.radialFogEffect = new RadialFogEffect();

    const effectPass = new EffectPass(camera, ssaoEffect, this.lensingEffect, this.radialFogEffect);
    this.composer.addPass(effectPass);
    
    this.resize(width, height);
  }

  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public destroy(): void {
    this.composer.dispose();
  }

  public render(_scene: THREE.Scene, camera: THREE.PerspectiveCamera, msg: any): boolean {
    const state = msg?.gameState;
    let bhCount = 0;
    
    if (state?.black_holes && state.black_holes.length > 0) {
      bhCount = this.computeLensingUniforms(state.black_holes, camera);
    }

    this.lensingEffect.uniforms.get('uBlackHoleCount')!.value = bhCount;
    
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const mapW = state?.server_world?.width ?? WORLD_WIDTH;
    const mapH = state?.server_world?.height ?? WORLD_HEIGHT;

    this.radialFogEffect.uniforms.get('uHeadWorldPos')!.value.set(msg.camX || 0, msg.camY || 0);
    this.radialFogEffect.uniforms.get('uRadiusWorld')!.value = msg.fogRadiusWorld || 300.0;
    this.radialFogEffect.uniforms.get('uWorldSize')!.value.set(mapW * gridSize, mapH * gridSize);
    this.radialFogEffect.uniforms.get('uCameraMatrixWorld')!.value.copy(camera.matrixWorld);
    this.radialFogEffect.uniforms.get('uProjectionMatrixInverse')!.value.copy(camera.projectionMatrixInverse);

    this.composer.render();
    return true; // We now ALWAYS render via postprocessing because of SSAO
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
      const fadeFactor = distToCamPlane < fadeStart 
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
