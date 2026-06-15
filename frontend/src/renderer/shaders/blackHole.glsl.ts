// ROLE: Шейдер чёрной дыры (ядро, кольцо приращения, гравитационный пульс).
export const blackHoleCoreShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    void main() {
      float d = length(vUv - vec2(0.5)) * 2.0;
      if (d > 1.0) discard;
      float edge = 1.0 - smoothstep(0.9, 1.0, d);
      gl_FragColor = vec4(0.02, 0.02, 0.04, edge);
    }
  `
};

export const blackHoleRingShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vec2 center = vUv - vec2(0.5);
      float d = length(center) * 2.0;
      if (d < 0.9 || d > 1.8) discard;
      
      float angle = atan(center.y, center.x);
      float spiral = sin(angle * 5.0 - d * 12.0 - uTime * 12.0);
      float density = 0.5 + 0.5 * spiral;
      
      vec3 hotColor = vec3(1.0, 0.35, 0.0);
      vec3 superHotColor = vec3(1.0, 0.9, 0.1);
      vec3 col = mix(hotColor, superHotColor, density * 0.7);
      
      float alpha = density * (1.0 - smoothstep(0.9, 1.8, d));
      
      gl_FragColor = vec4(col, alpha);
    }
  `
};

export const blackHoleGravityShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vec2 center = vUv - vec2(0.5);
      float d = length(center) * 2.0;
      if (d > 1.0) discard;
      
      float pulse = fract(d * 4.0 + uTime * 1.5);
      float wave = 1.0 - smoothstep(0.0, 0.15, abs(pulse - 0.5));
      
      vec3 col = mix(vec3(0.3, 0.0, 0.8), vec3(0.9, 0.1, 0.7), wave * 0.5);
      float fade = (1.0 - d) * (0.15 + 0.25 * wave);
      
      gl_FragColor = vec4(col, fade);
    }
  `
};
