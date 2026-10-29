// ROLE: Инициализация Three.js сцены, hemisphere/key/fill свет, тени, туман, world-space contact shadow и рендерер.
import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { AdaptiveResolution } from "./AdaptiveResolution";
import { PostProcessing } from "./PostProcessing";
import { OVERLAY_LAYER, RenderConfig, RenderLayer } from "./RenderConfig";
import {
  loadRenderQuality,
  QUALITY_PRESETS,
  type QualityPreset,
  type RenderQuality,
  saveRenderQuality,
} from "./RenderQuality";
import { SnakeContactShadow } from "./SnakeContactShadow";
import { SnakeLightPool } from "./SnakeLightPool";
import { patchGroundMaterial } from "./shaders/ground.glsl";

const MIN_PIXEL_RATIO = 0.6;
const MAX_PIXEL_RATIO = 3;
const GROUND_Z = -2;

/**
 * Sunny-day rig. The camera looks down at ~55 degrees and the ground fills the
 * frame, so there is no sky dome to light the scene: the daylight read comes
 * from this warm key, the cool sky/ground hemisphere and the aerial fog.
 * Elevation is atan(270 / 300) ~= 42 degrees, which makes shadows long enough
 * to read without stretching them across the whole screen.
 */
export const SUN_OFFSET = { x: 240, y: 180, z: 270 } as const;
export const SUN_COLOR = 0xfff2dc;
export const SUN_INTENSITY = 4.2;
export const HEMI_SKY_COLOR = 0xb9d4ff;
export const HEMI_GROUND_COLOR = 0x7a6242;
export const HEMI_INTENSITY = 1.7;
export const FILL_COLOR = 0x9fc2ff;
export const FILL_INTENSITY = 0.12;
export const TONE_MAPPING_EXPOSURE = 1.2;
export const CLEAR_COLOR = 0x0b1420;
export const AERIAL_FOG_COLOR = 0x9db4c8;
/** Fog tint drifts toward the warm end when the camera looks into the sun. */
export const AERIAL_FOG_COOL = 0x9fb8cf;
export const AERIAL_FOG_WARM = 0xd6c6aa;

const FOG_VERTEX_SHADER = `
  varying vec2 vWorldPos;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xy;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FOG_FRAGMENT_SHADER = `
  uniform vec2 uHeadPos;
  uniform float uRadius;
  uniform float uTime;
  uniform vec3 uFogColor;
  varying vec2 vWorldPos;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    float dist = length(vWorldPos - uHeadPos);
    float wobble = (valueNoise(vWorldPos * 0.012 + vec2(uTime * 0.015, -uTime * 0.01)) - 0.5) * uRadius * 0.1;
    float edge = smoothstep(uRadius * 0.68, uRadius * 0.98, dist + wobble);
    float haze = smoothstep(uRadius * 0.62, uRadius * 0.82, dist) * (1.0 - smoothstep(uRadius * 0.82, uRadius, dist));
    vec3 color = uFogColor + vec3(0.020, 0.030, 0.045) * haze;
    float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(color, clamp(edge + dither, 0.0, 1.0));
  }
`;

export class SceneManager {
  private container: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private postProcessing!: PostProcessing;

  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private snakeLights!: SnakeLightPool;
  private groundMaterial!: THREE.MeshStandardMaterial;
  private groundMesh!: THREE.Mesh;
  private contactShadow!: SnakeContactShadow;

  private fogMaterial!: THREE.ShaderMaterial;
  private fogMesh!: THREE.Mesh;

  private currentWidth: number = 0;
  private currentHeight: number = 0;

  private quality: RenderQuality;
  private adaptiveResolution: AdaptiveResolution | null = null;
  private currentPixelRatio = 1;
  private lastFrameTime = 0;
  /** Reused per frame so the aerial-fog update does not allocate. */
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpFogColor = new THREE.Color();
  private readonly fogCool = new THREE.Color(AERIAL_FOG_COOL);
  private readonly fogWarm = new THREE.Color(AERIAL_FOG_WARM);

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.quality = loadRenderQuality();
    this.currentWidth = Math.max(1, this.container.clientWidth);
    this.currentHeight = Math.max(1, this.container.clientHeight);
    this.initRenderer();
    this.initSceneAndCamera();
    this.setupLighting();
    this.setupSnakeLights();
    this.setupGround();
    this.setupFog();
    this.setupContactShadow();
    this.initPostProcessing();
    window.addEventListener("resize", this.handleResize);
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
    // Linear aerial haze. near/far are refreshed every frame from the camera
    // distance so zoom and boost fov keep the same amount of distance haze.
    this.scene.fog = new THREE.Fog(AERIAL_FOG_COLOR, 1400, 3300);
  }

  private initPostProcessing(): void {
    const preset = QUALITY_PRESETS[this.quality];
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.scene,
      this.camera,
      this.currentWidth,
      this.currentHeight,
      { ssao: preset.ssao, bloom: preset.bloom },
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
    this.dirLight.castShadow = preset.shadows;
    this.groundMesh.receiveShadow = preset.shadows;
    this.configureShadowQuality(preset);
    this.snakeLights.setCount(preset.snakeLights);
    this.contactShadow.setBaseResolution(preset.contactShadow);

    this.postProcessing.setOptions({ ssao: preset.ssao, bloom: preset.bloom });

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
    this.lastFrameTime = performance.now();
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

  public destroy(): void {
    window.removeEventListener("resize", this.handleResize);
    this.snakeLights.destroy();
    this.contactShadow.dispose();
    this.postProcessing.destroy();
    this.fogMesh.geometry.dispose();
    this.fogMaterial.dispose();
    this.groundMesh.geometry.dispose();
    this.groundMaterial.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** Blurred contact mask for shaders that run before the shadow pass. */
  public getContactShadowFrame(): ReturnType<SnakeContactShadow["getFrame"]> {
    return this.contactShadow.getFrame();
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

  public render(msg: any): void {
    this.updateAdaptiveResolution();

    if (msg) {
      const camX = msg.camX || 0;
      const camY = msg.camY || 0;
      const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
      const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;
      this.updateGround(msg);
      this.snakeLights.update(msg.activePlayers, camX, camY);

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
      this.updateFog(msg);
      this.updateAerialFog(shadowDistance);
      this.contactShadow.setMapSize(mapW * gridSize, mapH * gridSize);
      this.contactShadow.setViewDistance(shadowDistance, this.camera.fov);
      this.contactShadow.setTarget(camX, camY);

      // Keep both light rigs centered on the camera. The key light is offset so
      // shadows and fruit shading read directionally instead of top-down flat.
      this.dirLight.position.set(camX + SUN_OFFSET.x, camY + SUN_OFFSET.y, SUN_OFFSET.z);
      this.dirLight.target.position.set(camX, camY, 0);
      this.dirLight.target.updateMatrixWorld();
      this.fillLight.position.set(camX - SUN_OFFSET.x, camY - SUN_OFFSET.y, 220);
      this.fillLight.target.position.set(camX, camY, 0);
      this.fillLight.target.updateMatrixWorld();

      // The visible fog radius is 900+ units; shadowing all of it at 2048
      // texels would be very coarse. Cover the useful near-field instead.
      const fogRadius = Math.min(msg.fogRadiusWorld ?? 300, 2000.0);
      const d = Math.min(900, Math.max(300, fogRadius * 0.8));
      const cam = this.dirLight.shadow.camera;
      if (cam.left !== -d || cam.right !== d || cam.top !== d || cam.bottom !== -d) {
        cam.left = -d;
        cam.right = d;
        cam.top = d;
        cam.bottom = -d;
        cam.updateProjectionMatrix();
      }
    }
    // Rasterize before the composer so the ground quad is part of the same
    // frame as the body whose silhouette it follows.
    this.contactShadow.render(this.renderer, this.scene);
    const rendered = this.postProcessing.render(this.scene, this.camera, msg);
    if (!rendered) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private setupLighting(): void {
    // Pale blue sky bounce + dry-grass soil bounce. With no environment map
    // this hemisphere term is the whole ambient budget, so it stays warm/cool
    // rather than neutral grey.
    this.hemiLight = new THREE.HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
    this.dirLight.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
    this.dirLight.castShadow = QUALITY_PRESETS[this.quality].shadows;
    this.configureShadowQuality(QUALITY_PRESETS[this.quality]);

    // Shadowless cool rim from the anti-sun side. It sculpts fruit and
    // tombstones without adding another shadow-map render pass.
    this.fillLight = new THREE.DirectionalLight(FILL_COLOR, FILL_INTENSITY);
    this.fillLight.position.set(-SUN_OFFSET.x, -SUN_OFFSET.y, 220);
    this.fillLight.castShadow = false;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);
  }

  private setupSnakeLights(): void {
    this.snakeLights = new SnakeLightPool(this.scene, QUALITY_PRESETS[this.quality].snakeLights);
  }

  private configureShadowQuality(preset: QualityPreset): void {
    // Three r184 deprecated PCFSoftShadowMap; PCF plus a radius gives a
    // similar soft edge with a smaller optional tap count.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const shadow = this.dirLight.shadow;
    shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    shadow.map?.dispose();
    shadow.map = null;
    shadow.bias = -0.0003;
    shadow.normalBias = 0.2;
    shadow.radius = preset.shadowRadius;

    const d = 900;
    shadow.camera.left = -d;
    shadow.camera.right = d;
    shadow.camera.top = d;
    shadow.camera.bottom = -d;
    shadow.camera.near = 1;
    shadow.camera.far = 2000;
    shadow.camera.updateProjectionMatrix();
  }

  private setupGround(): void {
    const uniforms = {
      uGroundColor: { value: new THREE.Color(0x6d7a4d) },
      uGridColor: { value: new THREE.Color(0x5a6540) },
      uGridSize: { value: gridSize },
    };

    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x6d7a4d,
      roughness: 1.0,
      metalness: 0.0,
    });
    this.groundMaterial.userData.uniforms = uniforms;
    this.groundMaterial.onBeforeCompile = (shader) => patchGroundMaterial(shader, uniforms);

    const sizeX = WORLD_WIDTH * gridSize * 4;
    const sizeY = WORLD_HEIGHT * gridSize * 4;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY);
    this.groundMesh = new THREE.Mesh(geom, this.groundMaterial);
    RenderConfig.configureMesh(this.groundMesh, RenderLayer.Ground);
    this.groundMesh.position.set(
      (WORLD_WIDTH * gridSize) / 2,
      -(WORLD_HEIGHT * gridSize) / 2,
      -2.0,
    );
    this.groundMesh.receiveShadow = QUALITY_PRESETS[this.quality].shadows;
    this.scene.add(this.groundMesh);
  }

  private setupContactShadow(): void {
    this.contactShadow = new SnakeContactShadow(this.scene, {
      resolution: QUALITY_PRESETS[this.quality].contactShadow,
      groundZ: GROUND_Z,
    });
  }

  private updateGround(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    // The geometry is a 4x apron, so a plain map-size scale gives both player
    // and spectator the same generous ground coverage near map edges.
    this.groundMesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
    this.groundMesh.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);
  }

  private setupFog(): void {
    const uniforms = {
      uHeadPos: { value: new THREE.Vector2(0, 0) },
      uRadius: { value: 300.0 },
      uTime: { value: 0.0 },
      uFogColor: { value: new THREE.Color(13 / 255, 24 / 255, 34 / 255) },
    };

    this.fogMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: FOG_VERTEX_SHADER,
      fragmentShader: FOG_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    const sizeX = WORLD_WIDTH * gridSize * 4;
    const sizeY = WORLD_HEIGHT * gridSize * 4;
    const geom = new THREE.PlaneGeometry(sizeX, sizeY);
    this.fogMesh = new THREE.Mesh(geom, this.fogMaterial);

    RenderConfig.configureMesh(this.fogMesh, RenderLayer.FogOverlay);
    this.fogMesh.layers.set(OVERLAY_LAYER);
    this.fogMesh.position.set((WORLD_WIDTH * gridSize) / 2, -(WORLD_HEIGHT * gridSize) / 2, 50.0);
    this.scene.add(this.fogMesh);
  }

  /**
   * Aerial perspective: linear fog from the camera to the ground target plus a
   * small warm drift when looking toward the sun. The camera never sees sky, so
   * this is what sells "outdoors in daylight" at distance.
   */
  private updateAerialFog(distance: number): void {
    const fog = this.scene.fog as THREE.Fog | null;
    if (!fog) return;

    fog.near = distance * 1.8;
    fog.far = distance * 4.0;

    this.camera.getWorldDirection(this.tmpForward);
    const horizontal = Math.hypot(this.tmpForward.x, this.tmpForward.y);
    if (horizontal < 1e-4) return;

    const sunLength = Math.hypot(SUN_OFFSET.x, SUN_OFFSET.y);
    const facing =
      (this.tmpForward.x * SUN_OFFSET.x + this.tmpForward.y * SUN_OFFSET.y) /
      (horizontal * sunLength);
    const warmMix = (0.5 + 0.5 * Math.min(1, Math.max(-1, facing))) * 0.2;

    this.tmpFogColor.lerpColors(this.fogCool, this.fogWarm, warmMix);
    // Slow lerp keeps a fast camera turn from popping the fog color.
    fog.color.lerp(this.tmpFogColor, 0.08);
  }

  private updateFog(msg: any): void {
    const camX = msg.camX || 0;
    const camY = msg.camY || 0;
    const isSpectator = msg.myId === "spectator_id";

    this.fogMesh.visible = !isSpectator;

    if (!isSpectator) {
      // Follow the camera perfectly so the plane never goes out of view
      this.fogMesh.position.set(camX, camY, 5.0);

      const uniforms = this.fogMaterial.uniforms;
      uniforms.uHeadPos.value.set(camX, camY);
      uniforms.uRadius.value = msg.fogRadiusWorld || 300.0;
      uniforms.uTime.value = performance.now() * 0.001;
    }
  }

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
