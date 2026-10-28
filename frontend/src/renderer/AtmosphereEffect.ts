// ROLE: Cheap final-screen grade: vignette, split-tone and dithering. No scene knowledge.
import { BlendFunction, Effect } from "postprocessing";

const fragmentShader = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 centered = uv * 2.0 - 1.0;
    float radius = length(centered);
    float vignette = 1.0 - smoothstep(0.5, 1.25, radius) * 0.52;

    vec3 color = inputColor.rgb * vignette;
    float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

    // Cool shadows and warm highlights tie the palette together.
    vec3 shadowTint = vec3(0.9, 0.96, 1.08);
    vec3 highlightTint = vec3(1.05, 1.01, 0.96);
    color *= mix(shadowTint, highlightTint, smoothstep(0.12, 0.85, luma));

    // A small saturation lift makes snake skins and fruit read better.
    color = mix(vec3(luma), color, 1.1);

    // Ordered-ish noise dither breaks 8-bit banding in the fog and vignette.
    float dither = (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
    outputColor = vec4(max(color + dither, vec3(0.0)), inputColor.a);
  }
`;

export class AtmosphereEffect extends Effect {
  constructor() {
    super("AtmosphereEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
    });
  }
}
