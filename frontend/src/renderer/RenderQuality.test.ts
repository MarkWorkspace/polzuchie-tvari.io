// @vitest-environment jsdom
// ROLE: Regression tests for graphics quality presets and persistence.
import { afterEach, describe, expect, it } from "vitest";
import {
  loadRenderQuality,
  QUALITY_PRESETS,
  RENDER_QUALITY_STORAGE_KEY,
  saveRenderQuality,
} from "./RenderQuality";

afterEach(() => {
  localStorage.clear();
});

describe("RenderQuality", () => {
  it("defaults to auto and ignores invalid stored values", () => {
    expect(loadRenderQuality()).toBe("auto");

    localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, "ultra");
    expect(loadRenderQuality()).toBe("auto");
  });

  it("persists a valid preset", () => {
    saveRenderQuality("medium");
    expect(localStorage.getItem(RENDER_QUALITY_STORAGE_KEY)).toBe("medium");
    expect(loadRenderQuality()).toBe("medium");
  });

  it("keeps the expected effects per preset", () => {
    expect(QUALITY_PRESETS.auto).toMatchObject({
      adaptive: true,
      shadows: true,
      shadowMapSize: 2048,
      shadowRadius: 6,
      snakeLights: 3,
      ssao: true,
      contactShadow: 512,
      grass: 1200,
    });
    expect(QUALITY_PRESETS.high).toMatchObject({
      adaptive: false,
      shadows: true,
      shadowMapSize: 2048,
      shadowRadius: 6,
      snakeLights: 3,
      ssao: true,
      contactShadow: 512,
      grass: 1200,
    });
    expect(QUALITY_PRESETS.medium).toMatchObject({
      shadowMapSize: 1024,
      shadowRadius: 3,
      snakeLights: 2,
      ssao: false,
      bloom: true,
      contactShadow: 512,
      grass: 600,
    });
    expect(QUALITY_PRESETS.low).toMatchObject({
      shadows: false,
      shadowMapSize: 512,
      shadowRadius: 0,
      snakeLights: 1,
      ssao: false,
      bloom: false,
      contactShadow: 256,
      grass: 0,
    });
    expect(QUALITY_PRESETS.low.grass).toBe(0);
    expect(QUALITY_PRESETS.low.contactShadow).toBe(256);
  });
});
