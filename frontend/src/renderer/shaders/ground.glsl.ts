// ROLE: Шейдер бесконечного пола с антиалиасинг-сеткой и дешёвой процедурной фактурой.
// Не знает про игровую логику и не меняет материалы напрямую.
export function patchGroundMaterial(shader: any, uniforms: any) {
  shader.uniforms.uGroundColor = uniforms.uGroundColor;
  shader.uniforms.uGridColor = uniforms.uGridColor;
  shader.uniforms.uGridSize = uniforms.uGridSize;
  shader.uniforms.uWorldSize = uniforms.uWorldSize;

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
    uniform vec2 uWorldSize;
    varying vec3 vWorldPosition;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoisePeriodic(vec2 p, vec2 period) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      vec2 i0 = mod(i, period);
      vec2 i1 = mod(i + 1.0, period);
      float a = hash21(i0);
      float b = hash21(vec2(i1.x, i0.y));
      float c = hash21(vec2(i0.x, i1.y));
      float d = hash21(i1);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
  ${shader.fragmentShader}`;

  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <color_fragment>",
    `
    #include <color_fragment>

    // The ground has to read as grass even where no tuft grows. The noise is
    // periodic over one map, so the pattern does not jump at the toroidal seam.
    vec2 worldXY = vWorldPosition.xy;
    vec2 mapUv = worldXY / max(uWorldSize, vec2(1.0));
    float camDist = length(worldXY - cameraPosition.xy);
    float detailFade = 1.0 - smoothstep(220.0, 850.0, camDist);

    float broad = valueNoisePeriodic(mapUv * 10.0, vec2(10.0));
    float clump = valueNoisePeriodic(mapUv * 62.0, vec2(62.0));
    float fine = valueNoisePeriodic(mapUv * 420.0, vec2(420.0));
    float grain = valueNoisePeriodic(mapUv * 1800.0, vec2(1800.0));

    // Two axis-aligned anisotropic layers read as grass fibres at both the
    // player zoom and the spectator overview. They stay periodic by using
    // integer cycle counts over the map.
    float strandX =
      valueNoisePeriodic(vec2(mapUv.x * 400.0, mapUv.y * 20.0), vec2(400.0, 20.0));
    float strandY =
      valueNoisePeriodic(vec2(mapUv.x * 20.0, mapUv.y * 400.0), vec2(20.0, 400.0));
    float strandMask = 0.6 + 0.4 * clump;
    float strands = (strandX * 0.6 + strandY * 0.4 - 0.5) * strandMask;

    float tone = broad * 0.46 + clump * 0.34 + (fine * 0.55 + grain * 0.45) * 0.2 * detailFade;
    tone = clamp(tone + strands * 0.28, 0.0, 1.0);

    vec3 grassDark = uGroundColor * 0.72;
    vec3 grassLight = uGroundColor * 1.34 + vec3(0.015, 0.025, 0.0);
    vec3 base = mix(grassDark, grassLight, tone);

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
