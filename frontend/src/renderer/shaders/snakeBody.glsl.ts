// ROLE: Шейдер плоской ленты: свет/AO, sRGB→linear скины, emissive и контур.

export const vertexShaderPrefix = `
  attribute vec3 customColor;
  attribute vec2 snakeParams;
  varying vec2 vUv;
  varying vec3 vCustomColor;
  varying vec3 vWorldPosition;
  varying vec2 vSnakeParams;
`;

export const vertexShaderReplace = `
  #include <worldpos_vertex>
  vUv = uv;
  vCustomColor = customColor;
  vSnakeParams = snakeParams;
  vWorldPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
`;

export const fragmentShaderPrefix = `
  varying vec2 vUv;
  varying vec3 vCustomColor;
  varying vec3 vWorldPosition;
  varying vec2 vSnakeParams;
  uniform float uTime;
  uniform float uMapWidth;
  uniform float uMapHeight;
  vec3 bodyFinalColor;

  vec3 srgbToLinear(vec3 color) {
    return pow(max(color, vec3(0.0)), vec3(2.2));
  }

  vec3 hslToRgb(float h, float s, float l) {
    float c = (1.0 - abs(2.0 * l - 1.0)) * s;
    float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
    float m = l - c * 0.5;
    vec3 rgb;
    if (h < 1.0 / 6.0) rgb = vec3(c, x, 0.0);
    else if (h < 2.0 / 6.0) rgb = vec3(x, c, 0.0);
    else if (h < 3.0 / 6.0) rgb = vec3(0.0, c, x);
    else if (h < 4.0 / 6.0) rgb = vec3(0.0, x, c);
    else if (h < 5.0 / 6.0) rgb = vec3(x, 0.0, c);
    else rgb = vec3(c, 0.0, x);
    return rgb + vec3(m);
  }
`;

/**
 * Shared by the visible body and the white contact-shadow mask material. Both
 * must round the head and tail the same way, otherwise the ground shadow keeps
 * square ends. Leaves the normalized contour distance in d_dist for edge shading.
 */
export const snakeContourGlsl = `
  float r = vSnakeParams.x;
  float L = vSnakeParams.y;
  float x = (vUv.x - 0.5) * 2.0 * r;
  float y = vUv.y;

  float d_dist = 0.0;
  if (y < 0.0) {
    d_dist = length(vec2(x, y)) / r;
  } else if (y > L) {
    d_dist = length(vec2(x, y - L)) / r;
  } else {
    d_dist = abs(x) / r;
  }
  if (d_dist > 1.0) discard;
`;

export const fragmentColorReplace = `
  #include <color_fragment>

  ${snakeContourGlsl}

  float skinType = vCustomColor.r;
  vec3 baseColor;

  if (skinType > 1.5) {
    float sCoord = vUv.y;

    if (skinType < 2.5) {
      float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
      baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.9, 0.9, 0.9), f);
    } else if (skinType < 3.5) {
      float f = 0.5 + 0.5 * cos((sCoord / 35.0) * 3.14159);
      baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.97, 0.45, 0.09), f);
    } else if (skinType < 4.5) {
      float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
      baseColor = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), f);
    } else {
      float h = mod(sCoord * 0.5 - uTime / 20.0, 360.0);
      baseColor = hslToRgb(h / 360.0, 1.0, 0.5);
    }
  } else {
    baseColor = vCustomColor;
  }

  // Skin hex values are authored/parsed in sRGB, while the lighting pipeline
  // works in linear space. Converting here keeps red from turning pastel.
  baseColor = srgbToLinear(baseColor);

  // Keep the body as the flat ribbon it was designed to be. Only the contour
  // darkens slightly so the silhouette stays readable on the ground.
  float edge = smoothstep(0.85, 0.98, d_dist);
  vec3 finalColor = mix(baseColor, baseColor * 0.8, edge);

  // Keep the ribbon readable as a colored light source; a lower diffuse term
  // prevents white ambient from washing the skin out to pastel.
  bodyFinalColor = finalColor;
  diffuseColor = vec4(finalColor * 0.45, opacity);
`;

export const emissiveReplace = `
  #include <emissivemap_fragment>
  // A self-lit term keeps the skin saturated under the cool ambient. Daylight
  // already lights the ribbon, so it only needs a small lift.
  totalEmissiveRadiance += bodyFinalColor * 0.55;
`;

export const saturationReplace = `
  // Counteract ACES/ambient desaturation on the bodies without touching the world.
  float bodyLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  outgoingLight = mix(vec3(bodyLuma), outgoingLight, 1.05);
  #include <opaque_fragment>
`;

export function patchSnakeMaterial(shader: any, uniforms: any) {
  shader.uniforms.uTime = uniforms.uTime;
  shader.uniforms.uMapWidth = uniforms.uMapWidth;
  shader.uniforms.uMapHeight = uniforms.uMapHeight;

  shader.vertexShader = vertexShaderPrefix + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    vertexShaderReplace,
  );

  shader.fragmentShader = fragmentShaderPrefix + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    fragmentColorReplace,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    emissiveReplace,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <opaque_fragment>",
    saturationReplace,
  );
}

/**
 * Silhouette counterpart of the body shader. The contact-shadow pass renders
 * the body with a white MeshBasicMaterial via scene.overrideMaterial, which
 * never sees the body's fragment discard; without this the mask would stay a
 * rectangle with square head/tail caps.
 */
export function patchSnakeShadowMaterial(shader: any) {
  shader.vertexShader = `
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec2 vSnakeParams;
  ${shader.vertexShader}`;
  shader.vertexShader = shader.vertexShader.replace(
    "#include <begin_vertex>",
    `#include <begin_vertex>
     vUv = uv;
     vSnakeParams = snakeParams;`,
  );

  shader.fragmentShader = `
    varying vec2 vUv;
    varying vec2 vSnakeParams;
  ${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <clipping_planes_fragment>",
    `#include <clipping_planes_fragment>
     ${snakeContourGlsl}`,
  );
}
