import * as THREE from 'three';
import { WORLD_WIDTH, WORLD_HEIGHT, gridSize } from './constants';

export const fogColor = new THREE.Color(12 / 255, 12 / 255, 15 / 255);
export const flatCircleGeo = new THREE.CircleGeometry(1, 32);
export const planeGeo = new THREE.PlaneGeometry(2, 2);
export const pupilGeo = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
pupilGeo.rotateX(Math.PI / 2); // Orient the hemisphere to point towards positive Z

export const shadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  uniforms: {
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uFogColor: { value: fogColor },
    uMapWidth: { value: WORLD_WIDTH * gridSize },
    uMapHeight: { value: WORLD_HEIGHT * gridSize }
  },
  vertexShader: `
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    void main() {
      vUv = uv;
      vSnakeParams = snakeParams;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uMapWidth;
    uniform float uMapHeight;
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
      
      float shadow = (1.0 - smoothstep(0.4, 1.0, d_dist)) * 0.45;
      if (shadow <= 0.01) discard;
      
      float dist = distance(vWorldPosition.xy, uCenter);
      float start = uRadius * 0.75;
      float end = uRadius * 0.95;
      float fogAmount = smoothstep(start, end, dist);
      
      gl_FragColor = vec4(vec3(0.0), shadow * (1.0 - fogAmount));
    }
  `
});

export const snakeMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: true,
  depthTest: true,
  side: THREE.DoubleSide,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0.0 },
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uFogColor: { value: fogColor },
    uMapWidth: { value: WORLD_WIDTH * gridSize },
    uMapHeight: { value: WORLD_HEIGHT * gridSize }
  },
  vertexShader: `
    attribute vec2 snakeParams;
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vWorldPosition;
    varying vec2 vSnakeParams;
    void main() {
      vUv = uv;
      vColor = color;
      vSnakeParams = snakeParams;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
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
      
      float skinType = vColor.r;
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
        baseColor = vColor;
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
});

export const foodShadowMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
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
      float shadow = exp(-d * d * 4.5) * 0.65;
      if (shadow <= 0.01) discard;
      gl_FragColor = vec4(0.0, 0.0, 0.0, shadow);
    }
  `
});

export const foodMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexColors: true,
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
    void main() {
      float d = length(vUv - vec2(0.5)) * 2.0;
      float body = 1.0 - smoothstep(0.58, 0.62, d);
      float glow = (1.0 - smoothstep(0.6, 1.0, d)) * 0.6;
      
      if (body <= 0.01 && glow <= 0.01) discard;
      
      vec3 glowColor = vColor * 0.7;
      vec3 finalColor = mix(glowColor, vColor, body);
      float finalAlpha = max(body, glow);
      
      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `
});

export const particleGeo = new THREE.PlaneGeometry(1, 1);
export const particleMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
export const eyeMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
export const pupilMat = new THREE.MeshBasicMaterial({
  color: 0x000000
});

export const portalDiskMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0.0 }
  },
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
});

export const portalRingMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  vertexColors: true,
  uniforms: {
    uTime: { value: 0.0 }
  },
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
});

export const blackHoleCoreMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
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
});

export const blackHoleRingMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0.0 }
  },
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
});

export const blackHoleGravityMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  uniforms: {
    uTime: { value: 0.0 }
  },
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
});

export const groundMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uFogColor: { value: fogColor },
    uGroundColor: { value: new THREE.Color(0xfafafa) },
    uGridColor: { value: new THREE.Color(0xe5e5e5) },
    uCenter: { value: new THREE.Vector2(0, 0) },
    uRadius: { value: 900.0 },
    uGridSize: { value: 20.0 },
    uWorldWidth: { value: WORLD_WIDTH },
    uWorldHeight: { value: WORLD_HEIGHT },
  },
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
});

export const hslToHex = (h: number, s: number, l: number) => {
  h = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  return (Math.round(f(0) * 255) << 16) + (Math.round(f(8) * 255) << 8) + Math.round(f(4) * 255);
};

export const lerpColors = (c1: string, c2: string, f: number) => {
  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);

  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);

  return (r << 16) + (g << 8) + b;
};

const colorCache = new Map<string, number>();
export const parseColor = (colorStr: string) => {
  if (!colorStr) return 0x22c55e;
  const cached = colorCache.get(colorStr);
  if (cached !== undefined) return cached;
  const parsed = parseInt(colorStr.replace('#', '0x'), 16) || 0x22c55e;
  colorCache.set(colorStr, parsed);
  return parsed;
};

export class FormulaParser {
  private tokens: string[] = [];
  private pos = 0;

  constructor(expression: string, s: number, l: number) {
    const regex = /\d+(?:\.\d+)?|[a-z_][a-z0-9_]*|[\+\-\*\/\^,\(\)]/gi;
    this.tokens = expression.match(regex) || [];
    this.pos = 0;
    
    for (let i = 0; i < this.tokens.length; i++) {
      const t = this.tokens[i].toLowerCase();
      if (t === "s" || t === "score") {
        this.tokens[i] = String(s);
      } else if (t === "l" || t === "len" || t === "length") {
        this.tokens[i] = String(l);
      } else if (t === "pi") {
        this.tokens[i] = String(Math.PI);
      } else if (t === "e") {
        this.tokens[i] = String(Math.E);
      }
    }
  }

  private peek(): string | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private consume(expected?: string): string {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");
    if (expected && token !== expected) throw new Error(`Expected token ${expected}`);
    this.pos++;
    return token;
  }

  public parse(): number {
    try {
      const val = this.parseExpression();
      if (this.peek() !== null) throw new Error("Extra tokens at end");
      return isNaN(val) ? 10.0 : val;
    } catch {
      return 10.0;
    }
  }

  private parseExpression(): number {
    let val = this.parseTerm();
    while (true) {
      const op = this.peek();
      if (op === "+" || op === "-") {
        this.consume();
        const rhs = this.parseTerm();
        val = op === "+" ? val + rhs : val - rhs;
      } else {
        break;
      }
    }
    return val;
  }

  private parseTerm(): number {
    let val = this.parseFactor();
    while (true) {
      const op = this.peek();
      if (op === "*" || op === "/") {
        this.consume();
        const rhs = this.parseFactor();
        val = op === "*" ? val * rhs : val / (rhs === 0 ? 0.001 : rhs);
      } else {
        break;
      }
    }
    return val;
  }

  private parseFactor(): number {
    let val = this.parsePrimary();
    while (this.peek() === "^") {
      this.consume();
      const exponent = this.parsePrimary();
      val = Math.pow(val, exponent);
    }
    return val;
  }

  private parsePrimary(): number {
    const token = this.consume();
    if (token === "(") {
      const val = this.parseExpression();
      this.consume(")");
      return val;
    }

    if (token === "-") {
      return -this.parsePrimary();
    }
    if (token === "+") {
      return this.parsePrimary();
    }

    const num = Number(token);
    if (!isNaN(num)) {
      return num;
    }

    const func = token.toLowerCase();
    if (["sin", "cos", "tan", "log", "log10", "sqrt", "abs", "exp", "min", "max", "pow"].includes(func)) {
      this.consume("(");
      const args: number[] = [];
      args.push(this.parseExpression());
      while (this.peek() === ",") {
        this.consume();
        args.push(this.parseExpression());
      }
      this.consume(")");

      switch (func) {
        case "sin": return Math.sin(args[0]);
        case "cos": return Math.cos(args[0]);
        case "tan": return Math.tan(args[0]);
        case "log": return Math.log(Math.max(0.001, args[0]));
        case "log10": return Math.log10(Math.max(0.001, args[0]));
        case "sqrt": return Math.sqrt(Math.max(0.0, args[0]));
        case "abs": return Math.abs(args[0]);
        case "exp": return Math.exp(args[0]);
        case "min": return Math.min(...args);
        case "max": return Math.max(...args);
        case "pow": return Math.pow(args[0], args[1] || 0);
      }
    }

    return 0.0;
  }
}

export function evaluateFormula(formula: string | number, score: number, length: number): number {
  if (typeof formula === "number") return formula;
  if (!formula || formula === "") return 10.0;
  const parser = new FormulaParser(formula, score, length);
  const result = parser.parse();
  return Math.max(0.1, result);
}
