// ROLE: Инициализация Three.js сцены, свет, рендерер.
import * as THREE from "three";
import { PostProcessing } from "./PostProcessing";
import { patchGroundMaterial } from "./shaders/ground.glsl";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from "../game/Config";
import { RenderConfig, RenderLayer } from "./RenderConfig";

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
  uniform vec3 uFogColor;
  varying vec2 vWorldPos;

  void main() {
    float dist = length(vWorldPos - uHeadPos);
    float alpha = smoothstep(uRadius * 0.7, uRadius, dist);
    gl_FragColor = vec4(uFogColor, alpha);
  }
`;

export class SceneManager {
  private container: HTMLDivElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private postProcessing!: PostProcessing;

  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private groundMaterial!: THREE.MeshStandardMaterial;
  private groundMesh!: THREE.Mesh;

  private fogMaterial!: THREE.ShaderMaterial;
  private fogMesh!: THREE.Mesh;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.initRenderer();
    this.initSceneAndCamera();
    this.setupLighting();
    this.setupGround();
    this.setupFog();
    this.initPostProcessing();
    window.addEventListener("resize", this.handleResize);
  }

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x050506, 1.0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  private initSceneAndCamera(): void {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.container.clientWidth / this.container.clientHeight,
      15.0,
      15000.0
    );
  }

  private initPostProcessing(): void {
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.scene,
      this.camera,
      this.container.clientWidth,
      this.container.clientHeight
    );
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

  public resize(): void {
    this.handleResize();
  }

  public render(msg: any): void {
    if (msg) {
      this.updateGround(msg);
      this.updateFog(msg);
      // Update light target to follow camera so shadows are always centered
      this.dirLight.position.set(msg.camX + 0.1, msg.camY + 0.1, 300);
      this.dirLight.target.position.set(msg.camX, msg.camY, 0);
      this.dirLight.target.updateMatrixWorld();

      // Dynamic shadow frustum matching fog radius
      const d = msg.fogRadiusWorld ?? 300;
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
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(0.1, 0.1, 300);
    this.dirLight.castShadow = true;
    
    // Configure shadow frustum size based on our view distance
    const d = 300;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 1000;
    
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    // Bias to prevent shadow acne
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.radius = 6; // Soft shadow edges
    
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
  }

  private setupGround(): void {
    const uniforms = {
      uGroundColor: { value: new THREE.Color(0x9a8c84) },
      uGridColor: { value: new THREE.Color(0x7a6e66) },
      uGridSize: { value: 20.0 },
      uWorldWidth: { value: WORLD_WIDTH },
      uWorldHeight: { value: WORLD_HEIGHT },
    };

    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x9a8c84,
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
    this.groundMesh.position.set((WORLD_WIDTH * gridSize) / 2, -(WORLD_HEIGHT * gridSize) / 2, -2.0);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  private updateGround(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    this.groundMesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
    this.groundMesh.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);

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
      uFogColor: { value: new THREE.Color(5 / 255, 5 / 255, 6 / 255) }, // Almost black
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

    // Follow the camera perfectly so the plane never goes out of view
    this.fogMesh.position.set(camX, camY, 5.0);

    const uniforms = this.fogMaterial.uniforms;
    uniforms.uHeadPos.value.set(camX, camY);
    uniforms.uRadius.value = msg.fogRadiusWorld || 300.0;
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.postProcessing.resize(width, height);
  };
}
