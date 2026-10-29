// ROLE: Screen-space spherical globe projection with limb darkening. Pure forward/inverse orthographic-sphere math plus one composited-image Effect. No scene knowledge.

import { BlendFunction, Effect } from "postprocessing";
import * as THREE from "three";

/**
 * Fraction of the screen's corner radius mapped to the sphere's equator.
 * 0 is flat/identity; 1 is the full tiny-planet look. 0.7 is a subtle bulge.
 */
export const GLOBE_SPHERE = 0.7;

function globeCornerRadius(aspect: number): number {
  return 0.5 * Math.sqrt(aspect * aspect + 1);
}

/**
 * Source-arc-length scale at aspect-corrected output radius `r`:
 * `Rp * asin(clamp(r / Rp)) / r`, where `Rp = R / u` and `R` is the corner
 * radius. The identity branch avoids 0 / 0 at the center.
 */
export function globeWarpScale(r: number, aspect: number, sphere: number): number {
  const cornerRadius = globeCornerRadius(aspect);
  const sphereRadius = cornerRadius / sphere;

  return r > 1e-5 ? (sphereRadius * Math.asin(Math.min(1, Math.max(0, r / sphereRadius)))) / r : 1;
}

/**
 * Crop that keeps the spherical resample inside the source buffer:
 * `asin(u) / u`, equal to `s(R) / R` and independent of aspect.
 */
export function globeOverscan(sphere: number): number {
  return Math.asin(sphere) / sphere;
}

/** Uniforms shared by the shader and the DOM/raycast inverse warp. */
export interface GlobeParams {
  aspect: number;
  sphere: number;
  overscan: number;
}

/**
 * Forward shader direction: given an output screen uv, return the source uv
 * that the globe shader samples from `inputBuffer`. Matches the shader exactly,
 * including its final clamp to [0, 1].
 */
export function globeSampleUv(
  screenX: number,
  screenY: number,
  p: GlobeParams,
): { x: number; y: number } {
  const dX = (screenX - 0.5) * p.aspect;
  const dY = screenY - 0.5;
  const r = Math.hypot(dX, dY);
  const scale = globeWarpScale(r, p.aspect, p.sphere) / p.overscan;

  return {
    x: Math.min(1, Math.max(0, 0.5 + (dX * scale) / p.aspect)),
    y: Math.min(1, Math.max(0, 0.5 + dY * scale)),
  };
}

/**
 * Inverse direction: given a world point's projected source uv (for example
 * from `Vector3.project`), return where that point appears on the warped
 * screen. Solves `a * scale(|a|) / overscan = A` analytically from the asin
 * profile: `|a| = Rp * sin(clamp(|A| * overscan / Rp, 0, pi / 2))`.
 *
 * Both helpers are odd around 0.5 in x and y, so either y convention (including
 * the DOM's top-down one) works directly; do not flip y.
 */
export function globeScreenUv(
  sourceX: number,
  sourceY: number,
  p: GlobeParams,
): { x: number; y: number } {
  const sourceOffsetX = (sourceX - 0.5) * p.aspect;
  const sourceOffsetY = sourceY - 0.5;
  const sourceRadius = Math.hypot(sourceOffsetX, sourceOffsetY);

  if (sourceRadius < 1e-12) return { x: 0.5, y: 0.5 };

  const sphereRadius = globeCornerRadius(p.aspect) / p.sphere;
  const angle = Math.min(Math.PI / 2, Math.max(0, (sourceRadius * p.overscan) / sphereRadius));
  const screenRadius = sphereRadius * Math.sin(angle);
  const directionScale = screenRadius / sourceRadius;

  return {
    x: 0.5 + (sourceOffsetX * directionScale) / p.aspect,
    y: 0.5 + sourceOffsetY * directionScale,
  };
}

const globeFragmentShader = `
  uniform float uAspect;
  uniform float uSphere;
  uniform float uOverscan;
  uniform float uLimbStrength;
  uniform vec3 uLimbColor;

  float globeWarpScale(float r, float aspect, float sphere) {
    float cornerRadius = 0.5 * sqrt(aspect * aspect + 1.0);
    float sphereRadius = cornerRadius / sphere;
    return r > 1e-5
      ? (sphereRadius * asin(clamp(r / sphereRadius, 0.0, 1.0))) / r
      : 1.0;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
    float r = length(d);
    float scale = globeWarpScale(r, uAspect, uSphere);

    // Resample the already-composited frame through the spherical bulge. The
    // overscan division rescales the arc length back into the source buffer.
    vec3 color = texture2D(
      inputBuffer,
      clamp(0.5 + d * scale / uOverscan / vec2(uAspect, 1.0), 0.0, 1.0)
    ).rgb;

    // Limb darkening now follows the same corner radius as the sphere profile.
    float cornerRadius = 0.5 * sqrt(uAspect * uAspect + 1.0);
    float limb = smoothstep(0.45, 1.0, r / cornerRadius);
    color = mix(color, uLimbColor, limb * uLimbStrength);

    outputColor = vec4(color, inputColor.a);
  }
`;

export class GlobeEffect extends Effect {
  constructor() {
    const aspect = 1;
    super("GlobeEffect", globeFragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, any>([
        ["uAspect", new THREE.Uniform(aspect)],
        ["uSphere", new THREE.Uniform(GLOBE_SPHERE)],
        ["uOverscan", new THREE.Uniform(globeOverscan(GLOBE_SPHERE))],
        ["uLimbStrength", new THREE.Uniform(0.35)],
        ["uLimbColor", new THREE.Uniform(new THREE.Color(0x070b14))],
      ]),
    });
  }
}
