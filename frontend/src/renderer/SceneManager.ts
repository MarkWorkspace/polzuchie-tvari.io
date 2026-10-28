// ROLE: Инициализация Three.js сцены, свет, рендерер.
import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { AdaptiveResolution } from "./AdaptiveResolution";
import { PostProcessing } from "./PostProcessing";
import { RenderConfig, RenderLayer } from "./RenderConfig";
import {
  loadRenderQuality,
  QUALITY_PRESETS,
  type QualityPreset,
  type RenderQuality,
  saveRenderQuality,
} from "./RenderQuality";
import { patchGroundMaterial } from "./shaders/ground.glsl";

const MIN_PIXEL_RATIO = 0.6;
const MAX_PIXEL_RATIO = 3;

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
    vec3 color = uFogColor + vec3(0.018, 0.026, 0.045) * haze;
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
  private groundMaterial!: THREE.MeshStandardMaterial;
  private groundMesh!: THREE.Mesh;

  private fogMaterial!: THREE.ShaderMaterial;
  private fogMesh!: THREE.Mesh;

  private currentWidth: number = 0;
  private currentHeight: number = 0;

  private quality: RenderQuality;
  private adaptiveResolution: AdaptiveResolution | null = null;
  private currentPixelRatio = 1;
  private lastFrameTime = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.quality = loadRenderQuality();
    this.currentWidth = Math.max(1, this.container.clientWidth);
    this.currentHeight = Math.max(1, this.container.clientHeight);
    this.initRenderer();
    this.initSceneAndCamera();
    this.setupLighting();
    this.setupGround();
    this.setupFog();
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
    this.renderer.setClearColor(0x08090d, 1.0);
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
      this.updateGround(msg);
      this.updateFog(msg);

      // Keep both light rigs centered on the camera. The key light is offset so
      // shadows and fruit shading read directionally instead of top-down flat.
      this.dirLight.position.set(camX + 160, camY + 120, 300);
      this.dirLight.target.position.set(camX, camY, 0);
      this.dirLight.target.updateMatrixWorld();
      this.fillLight.position.set(camX - 180, camY - 140, 220);
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
    const rendered = this.postProcessing.render(this.scene, this.camera, msg);
    if (!rendered) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private setupLighting(): void {
    // Cool sky bounce + warm ground bounce gives the flat scene much more
    // depth than a single ambient light, for one cheap hemisphere sample.
    this.hemiLight = new THREE.HemisphereLight(0xbcd2ff, 0x4c3a2c, 0.8);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff1db, 1.45);
    this.dirLight.position.set(160, 120, 300);
    this.dirLight.castShadow = QUALITY_PRESETS[this.quality].shadows;
    this.configureShadowQuality(QUALITY_PRESETS[this.quality]);

    // Shadowless cool fill from the opposite side. It sculpts fruit and
    // tombstones without adding another shadow-map render pass.
    this.fillLight = new THREE.DirectionalLight(0x86a8ff, 0.35);
    this.fillLight.position.set(-180, -140, 220);
    this.fillLight.castShadow = false;

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    this.scene.add(this.fillLight);
    this.scene.add(this.fillLight.target);
  }

  private configureShadowQuality(preset: QualityPreset): void {
    // Three r184 deprecated PCFSoftShadowMap; PCF plus a radius gives a
    // similar soft edge with a smaller optional tap count.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const shadow = this.dirLight.shadow;
    shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    shadow.map?.dispose();
    shadow.map = null;
    shadow.bias = -0.001;
    shadow.normalBias = 0.5;
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
      uGroundColor: { value: new THREE.Color(0x847a72) },
      uGridColor: { value: new THREE.Color(0x5f574f) },
      uGridSize: { value: 20.0 },
      uWorldWidth: { value: WORLD_WIDTH },
      uWorldHeight: { value: WORLD_HEIGHT },
    };

    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x847a72,
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

  private updateGround(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;
    // Keep the same generous ground apron in spectator mode too; a map-sized
    // plane leaves a hard black half-screen when following a player near an edge.
    const multiplier = 4;

    this.groundMesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
    this.groundMesh.scale.set(
      (mapW / WORLD_WIDTH) * (multiplier / 4),
      (mapH / WORLD_HEIGHT) * (multiplier / 4),
      1.0,
    );

    const uniforms = this.groundMaterial.userData.uniforms;
    if (uniforms) {
      uniforms.uWorldWidth.value = mapW;
      uniforms.uWorldHeight.value = mapH;
    }
  }

  private setupFog(): void {
    const uniforms = {
      uHeadPos: { value: new THREE.Vector2(0, 0) },
      uRadius: { value: 300.0 },
      uTime: { value: 0.0 },
      uFogColor: { value: new THREE.Color(8 / 255, 9 / 255, 13 / 255) },
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
    this.fogMesh.position.set((WORLD_WIDTH * gridSize) / 2, -(WORLD_HEIGHT * gridSize) / 2, 50.0);
    this.scene.add(this.fogMesh);
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
