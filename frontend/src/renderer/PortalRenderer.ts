// ROLE: Визуализация порталов.
import * as THREE from "three";
import { portalDiskShader, portalRingShader } from "./shaders/portal.glsl";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class PortalRenderer {
  private scene: THREE.Scene;
  private diskMaterial!: THREE.ShaderMaterial;
  private ringMaterial!: THREE.ShaderMaterial;
  private glowMaterial!: THREE.ShaderMaterial;

  private diskMesh!: THREE.InstancedMesh;
  private ringMesh!: THREE.InstancedMesh;
  private glowMesh!: THREE.InstancedMesh;
  private maxInstances = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this._initDiskAndRingMaterials();
    this._initGlowMaterial();
    this._initMeshes();
  }

  private _initDiskAndRingMaterials(): void {
    this.diskMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
      uniforms: { uTime: { value: 0.0 } },
      vertexShader: portalDiskShader.vertexShader, fragmentShader: portalDiskShader.fragmentShader
    });
    this.ringMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexColors: true,
      uniforms: { uTime: { value: 0.0 } },
      vertexShader: portalRingShader.vertexShader, fragmentShader: portalRingShader.fragmentShader
    });
  }

  private _initGlowMaterial(): void {
    const vs = `
      varying vec2 vUv;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(1.0);
        #endif
        vec4 localPos = vec4(position * 3.3, 1.0);
        vec4 worldPos = modelMatrix * instanceMatrix * localPos;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;
    const fs = `
      varying vec2 vUv;
      varying vec3 vColor;
      uniform float uTime;
      void main() {
        float d = length(vUv - vec2(0.5)) * 2.0;
        if (d > 1.0) discard;
        float intensity = pow(1.0 - d, 2.5) * 1.2;
        intensity *= 0.85 + 0.15 * sin(uTime * 4.0);
        gl_FragColor = vec4(vColor, intensity);
      }
    `;
    this.glowMaterial = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: true,
      uniforms: { uTime: { value: 0.0 } },
      vertexShader: vs, fragmentShader: fs
    });
  }

  private _initMeshes(): void {
    const geom = new THREE.CircleGeometry(1, 32);

    this.diskMesh = new THREE.InstancedMesh(geom, this.diskMaterial, this.maxInstances);
    this.diskMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.diskMesh, RenderLayer.PortalDisk);
    this.scene.add(this.diskMesh);

    this.ringMesh = new THREE.InstancedMesh(geom, this.ringMaterial, this.maxInstances);
    this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.ringMesh, RenderLayer.PortalRing);
    this.scene.add(this.ringMesh);

    this.glowMesh = new THREE.InstancedMesh(geom, this.glowMaterial, this.maxInstances);
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.glowMesh, RenderLayer.PortalGlow);
    this.scene.add(this.glowMesh);
  }

  public update(msg: any, timeSec: number): void {
    this.diskMaterial.uniforms.uTime.value = timeSec;
    this.ringMaterial.uniforms.uTime.value = timeSec;
    this.glowMaterial.uniforms.uTime.value = timeSec;

    const count = msg.portalCount || 0;
    if (count > 0 && msg.portalDiskMatrices) {
      this.updatePortalBuffers(msg, count);
    } else {
      this.diskMesh.count = 0;
      this.ringMesh.count = 0;
      this.glowMesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.diskMesh);
    this.scene.remove(this.ringMesh);
    this.scene.remove(this.glowMesh);
    this.diskMesh.geometry.dispose();
    this.diskMaterial.dispose();
    this.ringMaterial.dispose();
    this.glowMaterial.dispose();
  }

  private _updateSinglePortalMesh(mesh: THREE.InstancedMesh, matrices: Float32Array, colors: Float32Array, count: number): void {
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (!mesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = attr;
    }
    mesh.instanceColor.array.set(colors);
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, count * 3);
    mesh.instanceColor.needsUpdate = true;
    mesh.count = count;
  }

  private updatePortalBuffers(msg: any, count: number): void {
    this._updateSinglePortalMesh(this.diskMesh, msg.portalDiskMatrices, msg.portalDiskColors, count);
    this._updateSinglePortalMesh(this.ringMesh, msg.portalRingMatrices, msg.portalRingColors, count);
    this._updateSinglePortalMesh(this.glowMesh, msg.portalDiskMatrices, msg.portalDiskColors, count);
  }
}
