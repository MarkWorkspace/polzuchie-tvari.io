// ROLE: Шейдер портала (диск и кольцо).
export const portalDiskShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = vec3(1.0);
      #endif
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vec2 center = vUv - vec2(0.5);
      float d = length(center) * 2.0;
      if (d > 1.0) discard;
      
      float angle = atan(center.y, center.x);
      float spiral = sin(angle * 3.0 - d * 8.0 + uTime * 6.0);
      float wave = 0.5 + 0.5 * spiral;
      
      vec3 col = mix(vColor * 0.4, vColor * 1.3, wave);
      float alpha = (1.0 - d) * (0.6 + 0.4 * wave);
      
      gl_FragColor = vec4(col, alpha);
    }
  `
};

export const portalRingShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      #ifdef USE_INSTANCING_COLOR
        vColor = instanceColor;
      #else
        vColor = vec3(1.0);
      #endif
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vec2 center = vUv - vec2(0.5);
      float d = length(center) * 2.0;
      if (d < 0.85 || d > 1.0) discard;
      
      float angle = atan(center.y, center.x);
      float dash = step(0.3, sin(angle * 8.0 + uTime * 4.0));
      
      vec3 col = vColor * 1.5;
      float alpha = dash * 0.9;
      
      gl_FragColor = vec4(col, alpha);
    }
  `
};
