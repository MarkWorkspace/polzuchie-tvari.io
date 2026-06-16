// ROLE: Визуализация порталов.
import * as THREE from "three";
import { portalDiskShader, portalRingShader } from "./shaders/portal.glsl";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class PortalRenderer {
  private scene: THREE.Scene;
  private diskMaterial: THREE.ShaderMaterial;
  private ringMaterial: THREE.ShaderMaterial;
  private glowMaterial: THREE.ShaderMaterial;

  private diskMesh: THREE.InstancedMesh;
  private ringMesh: THREE.InstancedMesh;
  private glowMesh: THREE.InstancedMesh;
  private maxInstances = 100;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Create Materials
    this.diskMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: portalDiskShader.vertexShader,
      fragmentShader: portalDiskShader.fragmentShader
    });

    this.ringMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: portalRingShader.vertexShader,
      fragmentShader: portalRingShader.fragmentShader
    });

    this.glowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          vUv = uv;
          #ifdef USE_INSTANCING_COLOR
            vColor = instanceColor;
          #else
            vColor = vec3(1.0);
          #endif
          // Scale up the glow radius by 3.3 to illuminate everything nearby (reduced by 1.5x)
          vec4 localPos = vec4(position * 3.3, 1.0);
          vec4 worldPos = modelMatrix * instanceMatrix * localPos;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
          float d = length(vUv - vec2(0.5)) * 2.0;
          if (d > 1.0) discard;
          // Soft exponential falloff for real light glow
          float intensity = pow(1.0 - d, 2.5) * 1.2;
          // Add a slow pulsation
          intensity *= 0.85 + 0.15 * sin(uTime * 4.0);
          gl_FragColor = vec4(vColor, intensity);
        }
      `
    });

    // 2. Create Instanced Meshes
    const geom = new THREE.CircleGeometry(1, 32);

    this.diskMesh = new THREE.InstancedMesh(geom, this.diskMaterial, this.maxInstances);
    RenderConfig.configureMesh(this.diskMesh, RenderLayer.PortalDisk);
    this.scene.add(this.diskMesh);

    this.ringMesh = new THREE.InstancedMesh(geom, this.ringMaterial, this.maxInstances);
    RenderConfig.configureMesh(this.ringMesh, RenderLayer.PortalRing);
    this.scene.add(this.ringMesh);

    this.glowMesh = new THREE.InstancedMesh(geom, this.glowMaterial, this.maxInstances);
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

  private updatePortalBuffers(msg: any, count: number): void {
    // Disk Mesh
    this.diskMesh.instanceMatrix.array.set(msg.portalDiskMatrices);
    this.diskMesh.instanceMatrix.needsUpdate = true;
    if (!this.diskMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.diskMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.diskMesh.instanceColor.array.set(msg.portalDiskColors);
    this.diskMesh.instanceColor.needsUpdate = true;
    this.diskMesh.count = count;

    // Ring Mesh
    this.ringMesh.instanceMatrix.array.set(msg.portalRingMatrices);
    this.ringMesh.instanceMatrix.needsUpdate = true;
    if (!this.ringMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.ringMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.ringMesh.instanceColor.array.set(msg.portalRingColors);
    this.ringMesh.instanceColor.needsUpdate = true;
    this.ringMesh.count = count;

    // Glow Mesh (reuses disk matrices/colors)
    this.glowMesh.instanceMatrix.array.set(msg.portalDiskMatrices);
    this.glowMesh.instanceMatrix.needsUpdate = true;
    if (!this.glowMesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      this.glowMesh.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3);
    }
    this.glowMesh.instanceColor.array.set(msg.portalDiskColors);
    this.glowMesh.instanceColor.needsUpdate = true;
    this.glowMesh.count = count;
  }
}
