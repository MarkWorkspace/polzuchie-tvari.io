// ROLE: Regression test for the body shader patch points and color-space conversion.
import { describe, expect, it } from "vitest";
import { patchSnakeMaterial } from "./snakeBody.glsl";

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
