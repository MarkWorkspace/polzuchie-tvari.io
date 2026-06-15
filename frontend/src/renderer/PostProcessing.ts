// ROLE: Линзирование, туман.
import * as THREE from "three";
import { gridSize } from "../game/Config";

export class PostProcessing {
  private renderer: THREE.WebGLRenderer;
  private renderTarget: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private lensingMaterial: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

  private bhPositionsArray = new Float32Array(30);
  private tempVec3 = new THREE.Vector3();
  private tempProjected = new THREE.Vector3();

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.renderer = renderer;

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.lensingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uBlackHoles: { value: this.bhPositionsArray },
        uBlackHoleCount: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uBlackHoles[10];
        uniform int uBlackHoleCount;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
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
          
          gl_FragColor = texture2D(tDiffuse, uv - totalDistortion);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    const geo = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(geo, this.lensingMaterial);
    this.postScene.add(this.quadMesh);
  }

  public resize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  public destroy(): void {
    this.quadMesh.geometry.dispose();
    this.lensingMaterial.dispose();
    this.renderTarget.dispose();
  }

  public render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    msg: any
  ): boolean {
    const state = msg?.gameState;
    if (!state?.black_holes || state.black_holes.length === 0) {
      return false; // Skip post-processing
    }

    const bhCount = this.computeLensingUniforms(state.black_holes, camera);
    if (bhCount === 0) {
      return false;
    }

    this.lensingMaterial.uniforms.uBlackHoles.value = this.bhPositionsArray;
    this.lensingMaterial.uniforms.uBlackHoleCount.value = bhCount;
    this.lensingMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;

    // 1. Render scene to offscreen target texture
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);

    // 2. Render fullscreen lensing quad to screen
    this.renderer.render(this.postScene, this.postCamera);
    return true;
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
