// ROLE: Оркестратор Three.js рендера: сцена/камера/рендерер, пресеты качества, adaptive pixel ratio по GPU time с GpuWatchdog, общая body-маска змеек и contact shadow, композер и пересборка собственных GPU-ресурсов после webglcontextrestored. Свет/тени делегирует SceneLighting, землю — GroundPlane, туман — FogOverlay.
import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { AdaptiveResolution } from "./AdaptiveResolution";
import { FogOverlay } from "./FogOverlay";
import { GpuTimer } from "./GpuTimer";
import { GpuWatchdog } from "./GpuWatchdog";
import { GROUND_Z, GroundPlane } from "./GroundPlane";
import { PostProcessing } from "./PostProcessing";
import { OVERLAY_LAYER } from "./RenderConfig";
import {
  loadRenderQuality,
  QUALITY_PRESETS,
  type QualityPreset,
  type RenderQuality,
  saveRenderQuality,
} from "./RenderQuality";
import { SceneLighting } from "./SceneLighting";
import { SnakeBodyMask } from "./SnakeBodyMask";
import { SnakeContactShadow } from "./SnakeContactShadow";

export { AERIAL_FOG_COLOR, AERIAL_FOG_COOL, AERIAL_FOG_WARM } from "./FogOverlay";
export { GROUND_Z } from "./GroundPlane";
export {
  FILL_COLOR,
  FILL_INTENSITY,
  HEMI_GROUND_COLOR,
  HEMI_INTENSITY,
  HEMI_SKY_COLOR,
  SUN_COLOR,
  SUN_INTENSITY,
  SUN_OFFSET,
} from "./SceneLighting";

const MIN_PIXEL_RATIO = 0.6;
const MAX_PIXEL_RATIO = 3;
export const TONE_MAPPING_EXPOSURE = 1.2;
export const CLEAR_COLOR = 0x0b1420;

export class SceneManager {
  private container: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private postProcessing!: PostProcessing;

  private lighting!: SceneLighting;
  private ground!: GroundPlane;
  private fog!: FogOverlay;
  private bodyMask!: SnakeBodyMask;
  private contactShadow!: SnakeContactShadow;

  private currentWidth: number = 0;
  private currentHeight: number = 0;

  private contextLost = false;
  private readonly contextLostListeners = new Set<() => void>();
  private readonly contextRestoredListeners = new Set<() => void>();

  private quality: RenderQuality;
  private adaptiveResolution: AdaptiveResolution | null = null;
  /** GPU-time source for adaptive resolution; null only until initRenderer finishes. */
  private gpuTimer: GpuTimer | null = null;
  private readonly gpuWatchdog = new GpuWatchdog(0, true);
  private currentPixelRatio = 1;
  private lastFrameTime = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.quality = loadRenderQuality();
    this.currentWidth = Math.max(1, this.container.clientWidth);
    this.currentHeight = Math.max(1, this.container.clientHeight);
    this.initRenderer();
    this.gpuTimer = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
    this.initSceneAndCamera();
    const preset = QUALITY_PRESETS[this.quality];
    this.lighting = new SceneLighting(this.scene, preset);
    this.ground = new GroundPlane(this.scene, preset);
    this.fog = new FogOverlay(this.scene, this.camera);
    this.setupGroundMasks();
    this.initPostProcessing();
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private initRenderer(): void {
    const preset = QUALITY_PRESETS[this.quality];
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: false,
    });
    this.currentPixelRatio = this.initialPixelRatio(preset);
    this.renderer.setPixelRatio(this.currentPixelRatio);
    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.renderer.setClearColor(CLEAR_COLOR, 1.0);
    // Tone mapping is owned by the composer's ToneMappingEffect. The renderer
    // must not tone map as well, but it still feeds toneMappingExposure into
    // the effect shader (the uniform lives in the shared chunk).
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
    this.renderer.shadowMap.enabled = preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.container.appendChild(this.renderer.domElement);
  }

  private initSceneAndCamera(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.currentWidth / this.currentHeight,
      15.0,
      15000.0,
    );
    this.camera.layers.enable(OVERLAY_LAYER);
  }

  private initPostProcessing(): void {
    const preset = QUALITY_PRESETS[this.quality];
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.scene,
      this.camera,
      this.currentWidth,
      this.currentHeight,
      { bloom: preset.bloom },
    );
    this.initAdaptiveResolution(preset);
  }

  public getQuality(): RenderQuality {
    return this.quality;
  }

  public getPixelRatio(): number {
    return this.currentPixelRatio;
  }

  public setQuality(quality: RenderQuality): void {
    if (quality === this.quality) return;

    this.quality = quality;
    saveRenderQuality(quality);

    const preset = QUALITY_PRESETS[quality];
    this.renderer.shadowMap.enabled = preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.lighting.setQuality(preset);
    this.ground.setReceiveShadow(preset.shadows);
    this.bodyMask.setBaseResolution(preset.contactShadow);

    this.postProcessing.setOptions({ bloom: preset.bloom });

    this.initAdaptiveResolution(preset);
    this.applyPixelRatio(this.adaptiveResolution?.getRatio() ?? this.maxPixelRatio(preset));
  }

  private maxPixelRatio(preset: QualityPreset): number {
    const deviceRatio = window.devicePixelRatio || 1;
    return Math.max(MIN_PIXEL_RATIO, Math.min(deviceRatio, preset.pixelRatioCap));
  }

  private initialPixelRatio(preset: QualityPreset): number {
    const maxRatio = this.maxPixelRatio(preset);
    // Start auto conservatively at 1x and let the sampler climb if there is headroom.
    return preset.adaptive ? Math.min(1, maxRatio) : maxRatio;
  }

  private initAdaptiveResolution(preset: QualityPreset): void {
    const maxRatio = this.maxPixelRatio(preset);
    this.adaptiveResolution = preset.adaptive
      ? new AdaptiveResolution(MIN_PIXEL_RATIO, maxRatio, Math.min(1, maxRatio))
      : null;
    const now = performance.now();
    this.lastFrameTime = now;
    this.gpuWatchdog.reset(now, document.visibilityState === "visible");
    this.gpuTimer?.reset();
  }

  private applyPixelRatio(ratio: number): void {
    const clamped = Math.max(MIN_PIXEL_RATIO, Math.min(MAX_PIXEL_RATIO, ratio));
    if (Math.abs(clamped - this.currentPixelRatio) < 0.01) return;

    this.currentPixelRatio = clamped;
    this.renderer.setPixelRatio(clamped);
    this.postProcessing.resize(this.currentWidth, this.currentHeight);
  }

  private updateAdaptiveResolution(): void {
    if (!this.adaptiveResolution) return;

    const now = performance.now();
    if (document.visibilityState !== "visible") {
      this.lastFrameTime = now;
      return;
    }

    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    const nextRatio = this.adaptiveResolution.sample(delta);
    if (nextRatio !== null) this.applyPixelRatio(nextRatio);
  }

  /**
   * GPU time is measured from the contact-shadow pass through the composer, so
   * it covers the actual draw cost without following VSync. Sampling only
   * happens in Auto; the frame-gap fallback is skipped entirely while this runs.
   */
  private updateAdaptiveResolutionFromGpu(timer: GpuTimer, applySample: boolean): void {
    const gpuMs = timer.poll();
    if (gpuMs === null) return;

    // Any usable result, even after a watchdog fallback, proves the timer works.
    this.gpuWatchdog.onSample(performance.now());

    // A probe result can arrive on a frame where the frame-time sampler already
    // steered the ratio; only the next frame should hand control back to the GPU.
    if (!applySample) return;

    const adaptive = this.adaptiveResolution;
    if (!adaptive) return;

    const nextRatio = adaptive.sampleGpu(gpuMs);
    if (nextRatio !== null) this.applyPixelRatio(nextRatio);
  }

  public destroy(): void {
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
    this.contextLostListeners.clear();
    this.contextRestoredListeners.clear();
    this.gpuTimer?.dispose();
    this.gpuTimer = null;
    this.lighting.destroy();
    this.ground.dispose();
    this.fog.dispose();
    this.contactShadow.dispose();
    this.bodyMask.dispose();
    this.postProcessing.destroy();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** Soft body silhouette for ground effects that run before the composer. */
  public getBodyMaskFrame(): ReturnType<SnakeBodyMask["getFrame"]> {
    return this.bodyMask.getFrame();
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getWidth(): number {
    return this.currentWidth;
  }

  public getHeight(): number {
    return this.currentHeight;
  }

  public resize(): void {
    this.handleResize();
  }

  /** Notifies the app once the GPU context is gone; the page cannot draw until a restore arrives. */
  public onContextLost(callback: () => void): () => void {
    this.contextLostListeners.add(callback);
    return () => {
      this.contextLostListeners.delete(callback);
    };
  }

  /** Notifies the app after the context is back and every owned GPU resource has been rebuilt. */
  public onContextRestored(callback: () => void): () => void {
    this.contextRestoredListeners.add(callback);
    return () => {
      this.contextRestoredListeners.delete(callback);
    };
  }

  private handleContextLost = (event: Event): void => {
    // preventDefault is required for the browser to ever emit webglcontextrestored.
    event.preventDefault();
    if (this.contextLost) return;

    this.contextLost = true;
    console.warn("SceneManager: WebGL context lost");
    for (const callback of this.contextLostListeners) {
      callback();
    }
  };

  /**
   * Three re-creates its own caches (programs, attributes, properties, state) on
   * restore, but everything this class holds a GL handle for must be replaced:
   * composer targets, contact-shadow targets, the shadow map and the timer query
   * all still point at the lost context.
   *
   * A failure keeps `contextLost` true and skips the notification, so the app
   * stays on the reload overlay instead of resuming with a half-built renderer.
   */
  private handleContextRestored = (): void => {
    if (!this.contextLost) return;

    const preset = QUALITY_PRESETS[this.quality];
    const now = performance.now();

    try {
      this.renderer.setPixelRatio(this.currentPixelRatio);
      this.renderer.setSize(this.currentWidth, this.currentHeight);
      this.renderer.setClearColor(CLEAR_COLOR, 1);
      // Tone mapping stays in the composer's ToneMappingEffect; exposure feeds it.
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
      this.renderer.shadowMap.enabled = preset.shadows;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.setRenderTarget(null);

      this.lighting.restore(preset);
      this.ground.setReceiveShadow(preset.shadows);

      // Must run after setPixelRatio: the bloom mask sizes itself from it.
      this.postProcessing.destroy();
      this.postProcessing = new PostProcessing(
        this.renderer,
        this.scene,
        this.camera,
        this.currentWidth,
        this.currentHeight,
        { bloom: preset.bloom },
      );

      // dispose() removes the ground quad from the scene, so the replacement
      // owns exactly one quad instead of stacking a second copy. The body mask
      // owns the render targets, so it is rebuilt before the shadow consumer.
      this.contactShadow.dispose();
      this.bodyMask.dispose();
      this.bodyMask = new SnakeBodyMask({
        resolution: preset.contactShadow,
        groundZ: GROUND_Z,
      });
      this.contactShadow = new SnakeContactShadow(this.scene, this.bodyMask, {
        groundZ: GROUND_Z,
      });

      // Queries belong to the lost context, so deleteQuery on the old wrapper is
      // meaningless; drop it and allocate a new query against the live context.
      this.gpuTimer = new GpuTimer(this.renderer.getContext() as WebGL2RenderingContext);
      this.gpuWatchdog.reset(now, document.visibilityState === "visible");
      this.lastFrameTime = now;

      this.contextLost = false;
    } catch (error) {
      console.error("SceneManager: WebGL context restore rebuild failed", error);
      return;
    }

    console.warn("SceneManager: WebGL context restored; GPU resources rebuilt");
    for (const callback of this.contextRestoredListeners) {
      callback();
    }
  };

  public render(msg: any): void {
    if (this.contextLost) return;

    const gpuTimer = this.gpuTimer;
    const visible = document.visibilityState === "visible";
    const now = performance.now();
    const gpuSupported = gpuTimer?.supported === true;

    // The watchdog rebaselines on visibility transitions and stale GPU samples;
    // one sampler may steer the ratio at a time.
    const useGpuSampler =
      this.adaptiveResolution !== null && this.gpuWatchdog.shouldUseGpu(now, visible, gpuSupported);

    if (!useGpuSampler) this.updateAdaptiveResolution();

    // A hidden tab can suspend GPU work for seconds; do not open a query then
    // or its elapsed time would describe the suspension, not a frame.
    const measureGpu = this.adaptiveResolution !== null && gpuSupported && visible;

    if (msg) {
      const camX = msg.camX || 0;
      const camY = msg.camY || 0;
      const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
      const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;
      this.ground.update(msg);
      this.lighting.update(msg.activePlayers, camX, camY, msg.fogRadiusWorld);

      // The contact shadow is world-space and camera-relative: follow the same
      // target as the ground, size its box from the view cone, and keep it
      // below one map period so a toroidal wrap copy cannot add a second
      // silhouette. The z term uses the ground plane the quad is baked onto.
      const shadowDx = this.camera.position.x - camX;
      const shadowDy = this.camera.position.y - camY;
      const shadowDz = this.camera.position.z - GROUND_Z;
      const shadowDistance = Math.sqrt(
        shadowDx * shadowDx + shadowDy * shadowDy + shadowDz * shadowDz,
      );
      this.fog.update(msg);
      this.fog.updateAerialFog(shadowDistance);
      this.bodyMask.setMapSize(mapW * gridSize, mapH * gridSize);
      this.bodyMask.setViewDistance(shadowDistance, this.camera.fov);
      this.bodyMask.setTarget(camX, camY);
      this.contactShadow.setTarget(camX, camY);
    }
    // Rasterize the shared body mask before the composer so the grass and the
    // contact-shadow quad see the same silhouette in the same frame.
    if (measureGpu && gpuTimer) gpuTimer.begin();
    try {
      this.bodyMask.render(this.renderer, this.scene);
      this.contactShadow.update();
      const rendered = this.postProcessing.render(this.scene, this.camera, msg);
      if (!rendered) {
        this.renderer.render(this.scene, this.camera);
      }
    } finally {
      // Always close the query so a render exception cannot leave it recording forever.
      if (measureGpu && gpuTimer) {
        gpuTimer.end();
        this.updateAdaptiveResolutionFromGpu(gpuTimer, useGpuSampler);
      }
    }
  }

  private setupGroundMasks(): void {
    this.bodyMask = new SnakeBodyMask({
      resolution: QUALITY_PRESETS[this.quality].contactShadow,
      groundZ: GROUND_Z,
    });
    this.contactShadow = new SnakeContactShadow(this.scene, this.bodyMask, {
      groundZ: GROUND_Z,
    });
  }

  /**
   * rAF is throttled or stopped in background tabs, so the hide event is often
   * the only signal we get. The watchdog rebaselines on the next transition.
   */
  private handleVisibilityChange = (): void => {
    this.gpuWatchdog.onVisibilityChange(document.visibilityState === "visible", performance.now());
  };

  private handleResize = (): void => {
    this.currentWidth = Math.max(1, this.container.clientWidth);
    this.currentHeight = Math.max(1, this.container.clientHeight);

    this.camera.aspect = this.currentWidth / this.currentHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.currentWidth, this.currentHeight);
    this.postProcessing.resize(this.currentWidth, this.currentHeight);
    this.lastFrameTime = performance.now();
  };
}
