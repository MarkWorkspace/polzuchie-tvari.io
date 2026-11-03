// ROLE: Aerial scene fog and the circular ground fog overlay: colors, shaders,
// fog range and warm/cool tint. Owns no camera rig, renderer or post pipeline.
import * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { OVERLAY_LAYER, RenderConfig, RenderLayer } from "./RenderConfig";
import { SUN_OFFSET } from "./SceneLighting";

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

export function aerialFogRange(distance: number): { near: number; far: number } {
  return { near: distance * 1.8, far: distance * 4.0 };
}

/**
 * Warm drift weight for a camera direction. The caller is responsible for
 * skipping a horizontal forward vector shorter than 1e-4.
 */
export function fogWarmMix(forwardX: number, forwardY: number, sunX: number, sunY: number): number {
  const horizontal = Math.hypot(forwardX, forwardY);
  const sunLength = Math.hypot(sunX, sunY);
  const facing = (forwardX * sunX + forwardY * sunY) / (horizontal * sunLength);
  return (0.5 + 0.5 * Math.min(1, Math.max(-1, facing))) * 0.2;
}

interface FogUniforms {
  [uniform: string]: THREE.IUniform;
  uHeadPos: THREE.IUniform<THREE.Vector2>;
  uRadius: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uFogColor: THREE.IUniform<THREE.Color>;
}

export class FogOverlay {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.Camera;
  private readonly material: THREE.ShaderMaterial;
  private readonly mesh: THREE.Mesh;
  private readonly uniforms: FogUniforms;
  /** Reused per frame so the aerial-fog update does not allocate. */
  private readonly tmpForward = new THREE.Vector3();
  private readonly tmpFogColor = new THREE.Color();
  private readonly fogCool = new THREE.Color(AERIAL_FOG_COOL);
  private readonly fogWarm = new THREE.Color(AERIAL_FOG_WARM);

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Linear aerial haze. near/far are refreshed every frame from the camera
    // distance so zoom and boost fov keep the same amount of distance haze.
    this.scene.fog = new THREE.Fog(AERIAL_FOG_COLOR, 1400, 3300);

    const uniforms: FogUniforms = {
      uHeadPos: { value: new THREE.Vector2(0, 0) },
      uRadius: { value: 300.0 },
      uTime: { value: 0.0 },
      uFogColor: { value: new THREE.Color(0.012, 0.022, 0.035) },
    };
    this.uniforms = uniforms;

    this.material = new THREE.ShaderMaterial({
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
    this.mesh = new THREE.Mesh(geom, this.material);

    RenderConfig.configureMesh(this.mesh, RenderLayer.FogOverlay);
    this.mesh.layers.set(OVERLAY_LAYER);
    this.mesh.position.set((WORLD_WIDTH * gridSize) / 2, -(WORLD_HEIGHT * gridSize) / 2, 50.0);
    this.scene.add(this.mesh);
  }

  public update(msg: any): void {
    const camX = msg.camX || 0;
    const camY = msg.camY || 0;
    const isSpectator = msg.myId === "spectator_id";

    this.mesh.visible = !isSpectator;

    if (!isSpectator) {
      // Follow the camera perfectly so the plane never goes out of view
      this.mesh.position.set(camX, camY, 5.0);

      const uniforms = this.uniforms;
      uniforms.uHeadPos.value.set(camX, camY);
      uniforms.uRadius.value = msg.fogRadiusWorld || 300.0;
      uniforms.uTime.value = performance.now() * 0.001;
    }
  }

  /**
   * Aerial perspective: linear fog from the camera to the ground target plus a
   * small warm drift when looking toward the sun. The camera never sees sky, so
   * this is what sells "outdoors in daylight" at distance.
   */
  public updateAerialFog(distance: number): void {
    const fog = this.scene.fog as THREE.Fog | null;
    if (!fog) return;

    fog.near = distance * 1.8;
    fog.far = distance * 4.0;

    this.camera.getWorldDirection(this.tmpForward);
    const horizontal = Math.hypot(this.tmpForward.x, this.tmpForward.y);
    if (horizontal < 1e-4) return;

    const warmMix = fogWarmMix(this.tmpForward.x, this.tmpForward.y, SUN_OFFSET.x, SUN_OFFSET.y);

    this.tmpFogColor.lerpColors(this.fogCool, this.fogWarm, warmMix);
    // Slow lerp keeps a fast camera turn from popping the fog color.
    fog.color.lerp(this.tmpFogColor, 0.08);
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.scene.fog = null;
  }
}
