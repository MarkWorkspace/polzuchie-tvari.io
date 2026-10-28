// ROLE: Шейдер бесконечного пола с антиалиасинг-сеткой и дешёвой процедурной фактурой.
// Не знает про игровую логику и не меняет материалы напрямую.
export function patchGroundMaterial(shader: any, uniforms: any) {
  shader.uniforms.uGroundColor = uniforms.uGroundColor;
  shader.uniforms.uGridColor = uniforms.uGridColor;
  shader.uniforms.uGridSize = uniforms.uGridSize;

  shader.vertexShader = `
    varying vec3 vWorldPosition;
  ${shader.vertexShader}`;

  shader.vertexShader = shader.vertexShader.replace(
    "#include <worldpos_vertex>",
    `
    #include <worldpos_vertex>
    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `,
  );

  shader.fragmentShader = `
    uniform vec3 uGroundColor;
    uniform vec3 uGridColor;
    uniform float uGridSize;
    varying vec3 vWorldPosition;

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
  ${shader.fragmentShader}`;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    `
    #include <color_fragment>

    // Two cheap noise octaves break up the flat slab without a texture fetch.
    vec2 worldXY = vWorldPosition.xy;
    float mottle = valueNoise(worldXY * 0.006) * 0.65 + valueNoise(worldXY * 0.025 + 17.0) * 0.35;
    vec3 base = uGroundColor * (0.92 + mottle * 0.16);

    // Derivative-based grid keeps lines crisp up close and prevents moire far away.
    vec2 cellCoord = worldXY / (uGridSize * 2.0);
    vec2 gridWidth = max(fwidth(cellCoord), vec2(0.0001));
    vec2 gridDist = abs(fract(cellCoord - 0.5) - 0.5) / gridWidth;
    float line = 1.0 - clamp(min(gridDist.x, gridDist.y), 0.0, 1.0);
    float camDist = length(worldXY - cameraPosition.xy);
    float gridFade = 1.0 - smoothstep(320.0, 1050.0, camDist);
    line *= gridFade * 0.55;

    // A faint 20-unit sub-grid adds density without turning the floor into graph paper.
    vec2 fineCoord = worldXY / uGridSize;
    vec2 fineWidth = max(fwidth(fineCoord), vec2(0.0001));
    vec2 fineDist = abs(fract(fineCoord - 0.5) - 0.5) / fineWidth;
    float fineLine = 1.0 - clamp(min(fineDist.x, fineDist.y), 0.0, 1.0);
    fineLine *= gridFade * 0.09;

    vec3 finalColor = mix(base, uGridColor, fineLine);
    finalColor = mix(finalColor, uGridColor, line);
    diffuseColor = vec4(finalColor, opacity);
    `,
  );
}
