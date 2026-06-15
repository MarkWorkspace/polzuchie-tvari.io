// ROLE: Шейдер еды и ее тени.
export const foodShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vCustomColor;
    void main() {
      vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vCustomColor = instanceColor;
      #else
        vCustomColor = vec3(1.0);
      #endif
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vCustomColor;
    void main() {
      float d = length(vUv - vec2(0.5)) * 2.0;
      float body = 1.0 - smoothstep(0.58, 0.62, d);
      float glow = (1.0 - smoothstep(0.6, 1.0, d)) * 0.6;
      
      if (body <= 0.01 && glow <= 0.01) discard;
      
      // Volumetric 3D sphere shading and ambient occlusion for food body
      vec3 bodyColor = vCustomColor;
      if (d < 0.6) {
        float sphereN = clamp(d / 0.6, 0.0, 1.0);
        float sphereNz = sqrt(max(0.0, 1.0 - sphereN * sphereN));
        bodyColor = vCustomColor * (0.55 + 0.45 * sphereNz) * (1.0 - pow(sphereN, 3.0) * 0.25);
      }
      vec3 glowColor = vCustomColor * 0.7;
      vec3 finalColor = mix(glowColor, bodyColor, body);
      float finalAlpha = max(body, glow);
      
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
};

