// ROLE: Система частиц (свечение хвоста). Не симулирует физику и не знает про игроков.
import * as THREE from "three";
import { OVERLAY_LAYER, RenderConfig, RenderLayer } from "./RenderConfig";

export class ParticleRenderer {
  private scene: THREE.Scene;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.InstancedMesh;
  private maxInstances = 2000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Soft additive sprite instead of a hard square: one texture-free quad.
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
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
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          if (d > 1.0) discard;
          float core = pow(max(0.0, 1.0 - d), 2.2);
          float glow = pow(max(0.0, 1.0 - d), 0.7) * 0.35;
          float alpha = (core + glow) * 0.8;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(vColor * (0.85 + core * 0.7), alpha);
        }
      `,
    });

    const geom = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.InstancedMesh(geom, this.material, this.maxInstances);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.mesh, RenderLayer.Particle);
    this.mesh.layers.set(OVERLAY_LAYER);
    this.scene.add(this.mesh);
  }

  public update(msg: any): void {
    const count = msg.particleCount || 0;
    if (count > 0 && msg.particleMatrices) {
      this.updateParticleBuffers(msg, count);
    } else {
      this.mesh.count = 0;
    }
  }

  public destroy(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private updateParticleBuffers(msg: any, count: number): void {
    this.mesh.instanceMatrix.array.set(msg.particleMatrices);
    this.mesh.instanceMatrix.clearUpdateRanges();
    this.mesh.instanceMatrix.addUpdateRange(0, count * 16);
    this.mesh.instanceMatrix.needsUpdate = true;

    if (!this.mesh.instanceColor) {
      const colorArray = new Float32Array(this.maxInstances * 3);
      const attr = new THREE.InstancedBufferAttribute(colorArray, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.mesh.instanceColor = attr;
    }
    this.mesh.instanceColor.array.set(msg.particleColors);
    this.mesh.instanceColor.clearUpdateRanges();
    this.mesh.instanceColor.addUpdateRange(0, count * 3);
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.count = count;
  }
}
