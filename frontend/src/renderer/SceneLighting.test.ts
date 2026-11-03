// ROLE: Unit tests for the shadow camera extent and the SceneLighting rig wiring.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { QUALITY_PRESETS } from "./RenderQuality";
import { SceneLighting, shadowCameraExtent } from "./SceneLighting";

function directionalLights(scene: THREE.Scene): THREE.DirectionalLight[] {
  return scene.children.filter(
    (child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight,
  );
}

function pointLights(scene: THREE.Scene): THREE.PointLight[] {
  return scene.children.filter(
    (child): child is THREE.PointLight => child instanceof THREE.PointLight,
  );
}

describe("shadowCameraExtent", () => {
  it("falls back to the default 300-unit fog radius", () => {
    expect(shadowCameraExtent(undefined)).toBe(300);
  });

  it("scales with the fog radius inside the 300..900 clamp", () => {
    expect(shadowCameraExtent(500)).toBe(400);
    expect(shadowCameraExtent(1000)).toBe(800);
  });

  it("clamps tiny radii up to 300", () => {
    expect(shadowCameraExtent(1)).toBe(300);
    expect(shadowCameraExtent(300)).toBe(300);
  });

  it("clamps large radii down to 900", () => {
    expect(shadowCameraExtent(2000)).toBe(900);
    expect(shadowCameraExtent(10000)).toBe(900);
  });
});

describe("SceneLighting wiring", () => {
  it("builds hemisphere, key/fill and snake lights from the preset", () => {
    const scene = new THREE.Scene();
    const lighting = new SceneLighting(scene, QUALITY_PRESETS.high);

    const hemisphere = scene.children.filter(
      (child): child is THREE.HemisphereLight => child instanceof THREE.HemisphereLight,
    );
    const directional = directionalLights(scene);
    const points = pointLights(scene);

    expect(hemisphere).toHaveLength(1);
    expect(directional).toHaveLength(2);
    expect(points).toHaveLength(4);
    expect(directional[0].castShadow).toBe(true);
    expect(points.filter((light) => light.visible)).toHaveLength(3);

    lighting.destroy();
  });

  it("follows the camera and clamps the shadow camera extent", () => {
    const scene = new THREE.Scene();
    const lighting = new SceneLighting(scene, QUALITY_PRESETS.high);

    lighting.update([], 10, 20, 1000);

    const [dirLight, fillLight] = directionalLights(scene);
    expect(dirLight.position.toArray()).toEqual([250, 200, 270]);
    expect(fillLight.position.toArray()).toEqual([-230, -160, 220]);
    expect(dirLight.shadow.camera.left).toBe(-800);
    expect(dirLight.shadow.camera.right).toBe(800);
    expect(dirLight.shadow.camera.top).toBe(800);
    expect(dirLight.shadow.camera.bottom).toBe(-800);

    lighting.destroy();
  });

  it("applies and restores the shadow/snake-light budget", () => {
    const scene = new THREE.Scene();
    const lighting = new SceneLighting(scene, QUALITY_PRESETS.high);
    const [dirLight] = directionalLights(scene);

    lighting.setQuality(QUALITY_PRESETS.low);
    expect(dirLight.castShadow).toBe(false);
    expect(pointLights(scene).filter((light) => light.visible)).toHaveLength(1);

    lighting.restore(QUALITY_PRESETS.high);
    expect(dirLight.castShadow).toBe(true);
    expect(pointLights(scene).filter((light) => light.visible)).toHaveLength(3);

    lighting.destroy();
  });

  it("removes every light and target on destroy", () => {
    const scene = new THREE.Scene();
    const lighting = new SceneLighting(scene, QUALITY_PRESETS.high);

    lighting.destroy();

    expect(scene.children).toHaveLength(0);
  });
});
