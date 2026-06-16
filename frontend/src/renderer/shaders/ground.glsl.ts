// ROLE: Шейдер бесконечного пола с сеткой (наследует свет, тени, туман и AO).

export function patchGroundMaterial(shader: any, uniforms: any) {
  shader.uniforms.uGroundColor = uniforms.uGroundColor;
  shader.uniforms.uGridColor = uniforms.uGridColor;
  shader.uniforms.uGridSize = uniforms.uGridSize;
  shader.uniforms.uWorldWidth = uniforms.uWorldWidth;
  shader.uniforms.uWorldHeight = uniforms.uWorldHeight;

  // Inject varyings
  shader.vertexShader = `
    varying vec3 vWorldPosition;
  ` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    '#include <worldpos_vertex>',
    `
    #include <worldpos_vertex>
    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `
  );

  // Inject uniforms and fragment logic
  shader.fragmentShader = `
    uniform vec3 uGroundColor;
    uniform vec3 uGridColor;
    uniform float uGridSize;
    uniform float uWorldWidth;
    uniform float uWorldHeight;
    varying vec3 vWorldPosition;
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `
    #include <color_fragment>
    
    float gridX = step(0.95, fract(vWorldPosition.x / (uGridSize * 2.0)));
    float gridY = step(0.95, fract(vWorldPosition.y / (uGridSize * 2.0)));
    float isGrid = max(gridX, gridY);
    
    vec3 finalColor = mix(uGroundColor, uGridColor, isGrid);
    
    diffuseColor = vec4(finalColor, opacity);
    `
  );
}
