// ROLE: Меши змеек, сплайны, тени. Не физика, не HUD.
import * as THREE from "three";
import { patchSnakeMaterial } from "./shaders/snakeBody.glsl";
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize, wrapOffsets } from "../game/Config";
import { RenderConfig, RenderLayer } from "./RenderConfig";

export class SnakeRenderer {
  private scene: THREE.Scene;
  private bodyMaterial!: THREE.MeshStandardMaterial;
  private eyeMaterial!: THREE.MeshBasicMaterial;
  private pupilMaterial!: THREE.MeshBasicMaterial;

  private bodyMesh!: THREE.InstancedMesh;
  private eyeMesh!: THREE.InstancedMesh;
  private pupilMesh!: THREE.InstancedMesh;
  private glowMesh!: THREE.InstancedMesh;
  private glowMaterial!: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
    this.initMeshes();
  }

  public update(msg: any, _camera?: THREE.PerspectiveCamera, _width?: number, _height?: number): void {
    this.updateUniforms(msg);
    this.updateGeometries(msg);
    this.updateInstancedParts(msg);
  }

  public destroy(): void {
    [this.bodyMesh, this.eyeMesh, this.pupilMesh, this.glowMesh].forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    });
    [this.bodyMaterial, this.eyeMaterial, this.pupilMaterial, this.glowMaterial].forEach((mat) => mat.dispose());
  }

  private updateUniforms(msg: any): void {
    const mapW = msg.gameState?.server_world?.width ?? WORLD_WIDTH;
    const mapH = msg.gameState?.server_world?.height ?? WORLD_HEIGHT;

    [this.bodyMaterial].forEach((mat) => {
      if (mat.userData.uniforms) {
        mat.userData.uniforms.uTime.value = performance.now();
        mat.userData.uniforms.uMapWidth.value = mapW * gridSize;
        mat.userData.uniforms.uMapHeight.value = mapH * gridSize;
      }
    });
  }

  private updateGeometries(msg: any): void {
    const bodyGeom = this.bodyMesh.geometry;
    if (msg.bodyVertices.length > 0) {
      this.updateDynamicAttr(bodyGeom, "position", msg.bodyVertices, 3);
      this.updateDynamicAttr(bodyGeom, "uv", msg.bodyUVs, 2);
      this.updateDynamicAttr(bodyGeom, "customColor", msg.bodyColors, 3);
      this.updateDynamicAttr(bodyGeom, "snakeParams", msg.bodySnakeParams, 2);
      this.updateDynamicIndex(bodyGeom, msg.bodyIndices);
      bodyGeom.setDrawRange(0, msg.bodyIndices.length);
    } else {
      bodyGeom.setDrawRange(0, 0);
    }
  }

  private updateInstancedParts(msg: any): void {
    const count = msg.eyeCount || 0;
    this._updateEyes(msg, count);

    const activePlayers = msg.activePlayers || [];
    const baseGlowRadius = msg.gameState?.server_visual?.head_glow_radius ?? 3.0;
    this._updateGlow(activePlayers, baseGlowRadius);
  }

  private _updateSingleEyeMesh(mesh: THREE.InstancedMesh, matrices: Float32Array, colors: Float32Array, count: number): void {
    mesh.instanceMatrix.array.set(matrices);
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (!mesh.instanceColor) {
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(2000 * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = attr;
    }
    mesh.instanceColor.array.set(colors);
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, count * 3);
    mesh.instanceColor.needsUpdate = true;
    mesh.count = count;
  }

  private _updateEyes(msg: any, count: number): void {
    if (count > 0 && msg.eyeMatrices) {
      this._updateSingleEyeMesh(this.eyeMesh, msg.eyeMatrices, msg.eyeColors, count);
      this._updateSingleEyeMesh(this.pupilMesh, msg.pupilMatrices, msg.pupilColors, msg.pupilCount || 0);
    } else {
      this.eyeMesh.count = 0;
      this.pupilMesh.count = 0;
    }
  }

  private _updateGlow(activePlayers: any[], baseGlowRadius: number): void {
    let glowCount = 0;
    if (baseGlowRadius > 0.0) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < activePlayers.length; i++) {
        const ap = activePlayers[i];
        if (ap.hx !== undefined && ap.hy !== undefined) {
          const finalRadius = ap.radius * gridSize + baseGlowRadius * gridSize;
          dummy.position.set(ap.hx, ap.hy, -0.1);
          dummy.scale.set(finalRadius, finalRadius, 1.0);
          dummy.updateMatrix();
          this.glowMesh.setMatrixAt(glowCount, dummy.matrix);
          glowCount++;
        }
      }
      if (glowCount > 0) {
        this.glowMesh.instanceMatrix.clearUpdateRanges();
        this.glowMesh.instanceMatrix.addUpdateRange(0, glowCount * 16);
        this.glowMesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.glowMesh.count = glowCount;
  }

  private initMaterials(): void {
    const uInit = {
      uTime: { value: 0.0 },
      uMapWidth: { value: WORLD_WIDTH * gridSize }, 
      uMapHeight: { value: WORLD_HEIGHT * gridSize }
    };

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide
    });
    this.bodyMaterial.userData.uniforms = uInit;
    this.bodyMaterial.onBeforeCompile = (shader) => {
      patchSnakeMaterial(shader, uInit);
    };

    this.eyeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(1.0, 0.6, 0.1) } // Warm orange glow
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float dist = length(vUv - 0.5) * 2.0;
          float alpha = smoothstep(1.0, 0.0, dist);
          alpha = pow(alpha, 1.5) * 0.2; 
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
  }

  private initMeshes(): void {
    this._initBodyMesh();
    this._initEyeAndGlowMeshes();
  }

  private _initBodyMesh(): void {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    this.bodyMesh = new THREE.InstancedMesh(geom, this.bodyMaterial, 9);
    geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000000);
    geom.computeBoundingSphere = () => { /* no-op */ };
    RenderConfig.configureMesh(this.bodyMesh, RenderLayer.SnakeBody, { castShadow: true });
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.Matrix4().makeTranslation(wrapOffsets[i][0], wrapOffsets[i][1], 0);
      this.bodyMesh.setMatrixAt(i, mat);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.bodyMesh);
  }

  private _initEyeAndGlowMeshes(): void {
    const circleGeom = new THREE.CircleGeometry(1, 32);
    const pupilGeom = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    pupilGeom.rotateX(Math.PI / 2.0);

    this.eyeMesh = new THREE.InstancedMesh(circleGeom, this.eyeMaterial, 2000);
    this.eyeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.eyeMesh, RenderLayer.SnakeEyes);
    this.scene.add(this.eyeMesh);

    this.pupilMesh = new THREE.InstancedMesh(pupilGeom, this.pupilMaterial, 2000);
    this.pupilMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.pupilMesh, RenderLayer.SnakePupils);
    this.scene.add(this.pupilMesh);

    const glowGeom = new THREE.PlaneGeometry(2, 2);
    this.glowMesh = new THREE.InstancedMesh(glowGeom, this.glowMaterial, 1000);
    this.glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    RenderConfig.configureMesh(this.glowMesh, RenderLayer.Shadow);
    this.scene.add(this.glowMesh);
  }

  private updateDynamicAttr(geom: THREE.BufferGeometry, name: string, data: Float32Array, itemSize: number): void {
    let attr = geom.getAttribute(name) as THREE.BufferAttribute | undefined;
    const requiredLength = data.length;

    if (!attr || attr.array.length < requiredLength) {
      const size = Math.max(Math.ceil(requiredLength * 1.3), 500000);
      attr = new THREE.BufferAttribute(new Float32Array(size), itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setAttribute(name, attr);
    }
    attr.array.set(data);
    attr.needsUpdate = true;
  }

  private updateDynamicIndex(geom: THREE.BufferGeometry, indices: Uint32Array): void {
    let attr = geom.getIndex();
    const requiredLength = indices.length;

    if (!attr || attr.array.length < requiredLength) {
      const size = Math.max(Math.ceil(requiredLength * 1.3), 500000);
      attr = new THREE.BufferAttribute(new Uint32Array(size), 1);
      attr.setUsage(THREE.DynamicDrawUsage);
      geom.setIndex(attr);
    }
    (attr.array as Uint32Array).set(indices);
    attr.needsUpdate = true;
  }
}
