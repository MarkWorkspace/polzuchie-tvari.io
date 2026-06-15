// ROLE: Шейдер тела змейки (5 скинов, GPU-клиппинг).
export const snakeBodyShader = {
  vertexShader: `
    attribute vec3 customColor;
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec3 vCustomColor;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    void main() {
      vUv = uv;
      vCustomColor = customColor;
      vSnakeParams = snakeParams;
      vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vCustomColor;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    uniform float uTime;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform vec3 uFogColor;
    uniform float uMapWidth;
    uniform float uMapHeight;

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

    void main() {
      float r = vSnakeParams.x;
      float L = vSnakeParams.y;
      float x = (vUv.x - 0.5) * 2.0 * r;
      float y = vUv.y;
      
      float d_dist = 0.0;
      if (y < 0.0) {
        d_dist = length(vec2(x, y)) / r;
        if (d_dist > 1.0) discard;
      } else if (y > L) {
        d_dist = length(vec2(x, y - L)) / r;
        if (d_dist > 1.0) discard;
      } else {
        d_dist = abs(x) / r;
      }
      
      // Clip parts outside the map boundaries, except for the head when near the boundary
      bool isInsideMap = (vWorldPosition.x >= 0.0 && vWorldPosition.x <= uMapWidth &&
                          vWorldPosition.y <= 0.0 && vWorldPosition.y >= -uMapHeight);
      bool isHead = (y >= L - r * 1.5);
      bool isNearMap = (vWorldPosition.x >= -r * 2.0 && vWorldPosition.x <= uMapWidth + r * 2.0 &&
                        vWorldPosition.y <= r * 2.0 && vWorldPosition.y >= -uMapHeight - r * 2.0);
      if (!isInsideMap && !(isHead && isNearMap)) discard;
      
      float skinType = vCustomColor.r;
      vec3 baseColor;
      
      if (skinType > 1.5) {
        float sCoord = vUv.y;
        
        if (skinType < 2.5) {
          // Zebra (25px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
          baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.9, 0.9, 0.9), f);
        } else if (skinType < 3.5) {
          // Tiger (35px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 35.0) * 3.14159);
          baseColor = mix(vec3(0.09, 0.09, 0.09), vec3(0.97, 0.45, 0.09), f);
        } else if (skinType < 4.5) {
          // Cyberpunk (25px wide stripes)
          float f = 0.5 + 0.5 * cos((sCoord / 25.0) * 3.14159);
          baseColor = mix(vec3(1.0, 0.0, 1.0), vec3(0.0, 1.0, 1.0), f);
        } else {
          // Rainbow (repeats every 720px)
          float h = mod(sCoord * 0.5 - uTime / 20.0, 360.0);
          baseColor = hslToRgb(h / 360.0, 1.0, 0.5);
        }
      } else {
        baseColor = vCustomColor;
      }
      
      // Flat premium contour edge outline
      float edge = smoothstep(0.85, 0.98, d_dist);
      vec3 finalColor = mix(baseColor, baseColor * 0.8, edge);
      
      // Apply GPU-based fog
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      float fogAmount = smoothstep(start, end, dist);
      vec3 finalColorWithFog = mix(finalColor, uFogColor, fogAmount);
      
      gl_FragColor = vec4(finalColorWithFog, 1.0);
    }
  `
};
