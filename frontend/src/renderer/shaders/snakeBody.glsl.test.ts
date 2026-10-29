// ROLE: Regression test for the body shader patch points, color-space conversion and shadow silhouette.
import { describe, expect, it } from "vitest";
import { patchSnakeMaterial, patchSnakeShadowMaterial } from "./snakeBody.glsl";

describe("patchSnakeMaterial", () => {
  it("injects linear skin color, emissive glow and saturation handling", () => {
    const shader = {
      uniforms: {},
      vertexShader: "#include <worldpos_vertex>",
      fragmentShader:
        "#include <color_fragment>\n#include <emissivemap_fragment>\n#include <opaque_fragment>",
    };

    patchSnakeMaterial(shader, {
      uTime: { value: 0 },
      uMapWidth: { value: 1 },
      uMapHeight: { value: 1 },
    });

    expect(shader.vertexShader).toContain("customColor");
    expect(shader.fragmentShader).toContain("srgbToLinear");
    expect(shader.fragmentShader).toContain("totalEmissiveRadiance += bodyFinalColor");
    expect(shader.fragmentShader).toContain("outgoingLight = mix");
  });
});

describe("patchSnakeShadowMaterial", () => {
  it("reproduces the rounded contour discard in the depth-only shader", () => {
    const shader = {
      vertexShader: "#include <begin_vertex>",
      fragmentShader: "#include <clipping_planes_fragment>",
    };

    patchSnakeShadowMaterial(shader);

    expect(shader.vertexShader).toContain("vSnakeParams = snakeParams");
    expect(shader.vertexShader).toContain("vUv = uv");
    expect(shader.fragmentShader).toContain("if (d_dist > 1.0) discard;");
    // The same contour math as the visible body keeps the shadow in sync.
    expect(shader.fragmentShader).toContain("length(vec2(x, y - L)) / r");
  });
});
