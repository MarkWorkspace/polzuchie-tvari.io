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

    // The ground has to read as grass even where no tuft grows. Three noise
    // octaves give broad patches, clump-scale variation and a fine grain; the
    // two high-frequency layers fade with distance so they cannot shimmer.
    vec2 worldXY = vWorldPosition.xy;
    float camDist = length(worldXY - cameraPosition.xy);
    float detailFade = 1.0 - smoothstep(220.0, 850.0, camDist);

    float broad = valueNoise(worldXY * 0.005);
    float clump = valueNoise(worldXY * 0.031 + 13.0);
    float fine = valueNoise(worldXY * 0.21 + 41.0);
    float grain = valueNoise(worldXY * 0.9 + 7.0);
    float tone = broad * 0.46 + clump * 0.34 + (fine * 0.55 + grain * 0.45) * 0.2 * detailFade;

    vec3 grassDark = uGroundColor * 0.72;
    vec3 grassLight = uGroundColor * 1.34 + vec3(0.015, 0.025, 0.0);
    vec3 base = mix(grassDark, grassLight, clamp(tone, 0.0, 1.0));

    // Derivative-based grid keeps lines crisp up close and prevents moire far away.
    vec2 cellCoord = worldXY / (uGridSize * 2.0);
    vec2 gridWidth = max(fwidth(cellCoord), vec2(0.0001));
    vec2 gridDist = abs(fract(cellCoord - 0.5) - 0.5) / gridWidth;
    float line = 1.0 - clamp(min(gridDist.x, gridDist.y), 0.0, 1.0);
    float gridFade = 1.0 - smoothstep(320.0, 1050.0, camDist);
    line *= gridFade * 0.42;

    // A faint 20-unit sub-grid adds density without turning the floor into graph paper.
    vec2 fineCoord = worldXY / uGridSize;
    vec2 fineWidth = max(fwidth(fineCoord), vec2(0.0001));
    vec2 fineDist = abs(fract(fineCoord - 0.5) - 0.5) / fineWidth;
    float fineLine = 1.0 - clamp(min(fineDist.x, fineDist.y), 0.0, 1.0);
    fineLine *= gridFade * 0.06;

    vec3 finalColor = mix(base, uGridColor, fineLine);
    finalColor = mix(finalColor, uGridColor, line);
    diffuseColor = vec4(finalColor, opacity);
    `,
  );
}
