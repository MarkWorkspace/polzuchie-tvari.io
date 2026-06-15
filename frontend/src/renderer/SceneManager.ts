// ROLE: Инициализация Three.js сцены, свет, рендерер.
import * as THREE from "three";
import { PostProcessing } from "./PostProcessing";
import { groundShader } from "./shaders/ground.glsl";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from "../game/Config";

export class SceneManager {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private postProcessing: PostProcessing;

  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private groundMaterial!: THREE.ShaderMaterial;
  private groundMesh!: THREE.Mesh;
  private shadowMesh!: THREE.Mesh;

  constructor(container: HTMLDivElement) {
    this.container = container;

    // 1. Create Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setClearColor(0x0c0c0f, 1.0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Create Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      50,
      this.container.clientWidth / this.container.clientHeight,
      15.0,
      15000.0
    );

    // 3. Init Lighting & Ground
    this.setupLighting();
    this.setupGround();

    // 4. Init Post Processing
    this.postProcessing = new PostProcessing(
      this.renderer,
      this.container.clientWidth,
      this.container.clientHeight
    );

    window.addEventListener("resize", this.handleResize);
  }

  public destroy(): void {
    window.removeEventListener("resize", this.handleResize);
    this.postProcessing.destroy();
    this.groundMesh.geometry.dispose();
    this.groundMaterial.dispose();
    if (this.shadowMesh) {
        this.shadowMesh.geometry.dispose();
        (this.shadowMesh.material as THREE.Material).dispose();
    }
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
    const fogColor = new THREE.Color(12 / 255, 12 / 255, 15 / 255);
    this.groundMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uFogColor: { value: fogColor },
        uGroundColor: { value: new THREE.Color(0xfafafa) },
        uGridColor: { value: new THREE.Color(0xe5e5e5) },
        uCenter: { value: new THREE.Vector2(0, 0) },
        uRadius: { value: 900.0 },
        uGridSize: { value: 20.0 },
        uWorldWidth: { value: WORLD_WIDTH },
        uWorldHeight: { value: WORLD_HEIGHT },
      },
      vertexShader: groundShader.vertexShader,
      fragmentShader: groundShader.fragmentShader
    });

    const geom = new THREE.PlaneGeometry(
      WORLD_WIDTH * gridSize * 4,
      WORLD_HEIGHT * gridSize * 4
    );
    this.groundMesh = new THREE.Mesh(geom, this.groundMaterial);
    this.groundMesh.position.set(
      (WORLD_WIDTH * gridSize) / 2,
      -(WORLD_HEIGHT * gridSize) / 2,
      -2.0
    );
    this.scene.add(this.groundMesh);
    
    // Add shadow catcher plane slightly above ground
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    this.shadowMesh = new THREE.Mesh(geom, shadowMat);
    this.shadowMesh.position.copy(this.groundMesh.position);
    this.shadowMesh.position.z = -1.9; // Just slightly above ground mesh
    this.shadowMesh.receiveShadow = true;
    this.scene.add(this.shadowMesh);
  }

  private updateGround(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    this.groundMesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -2.0);
    this.groundMesh.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);
    
    this.shadowMesh.position.set((mapW * gridSize) / 2, -(mapH * gridSize) / 2, -1.9);
    this.shadowMesh.scale.set(mapW / WORLD_WIDTH, mapH / WORLD_HEIGHT, 1.0);

    const uniforms = this.groundMaterial.uniforms;
    uniforms.uCenter.value.set(msg.camX, msg.camY);
    uniforms.uRadius.value = msg.fogRadiusWorld;
    uniforms.uWorldWidth.value = mapW;
    uniforms.uWorldHeight.value = mapH;
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

