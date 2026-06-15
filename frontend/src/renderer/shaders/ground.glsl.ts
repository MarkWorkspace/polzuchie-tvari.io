// ROLE: Шейдер бесконечного пола с сеткой и туманом.
export const groundShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uFogColor;
    uniform vec3 uGroundColor;
    uniform vec3 uGridColor;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uGridSize;
    uniform float uWorldWidth;
    uniform float uWorldHeight;
    varying vec3 vWorldPosition;
    
    void main() {
      float gridX = step(0.95, fract(vWorldPosition.x / (uGridSize * 2.0)));
      float gridY = step(0.95, fract(vWorldPosition.y / (uGridSize * 2.0)));
      float isGrid = max(gridX, gridY);
      
      float isOut = 0.0;
      if (vWorldPosition.x < 0.0 || vWorldPosition.x > uWorldWidth * uGridSize ||
          vWorldPosition.y > 0.0 || vWorldPosition.y < -uWorldHeight * uGridSize) {
          isOut = 1.0;
      }
                    
      vec3 finalColor = mix(uGroundColor, uGridColor, isGrid);
      if (isOut > 0.0) finalColor = vec3(0.0);
      
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      
      float fogAmount = smoothstep(start, end, dist);
      gl_FragColor = vec4(mix(finalColor, uFogColor, fogAmount), 1.0);
    }
  `
};
