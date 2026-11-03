// ROLE: Unit tests for aerial-fog helpers and the FogOverlay scene wiring.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { aerialFogRange, FogOverlay, fogWarmMix } from "./FogOverlay";
import { OVERLAY_LAYER } from "./RenderConfig";
import { SUN_OFFSET } from "./SceneLighting";

describe("aerialFogRange", () => {
  it("derives near/far from the camera distance", () => {
    expect(aerialFogRange(100)).toEqual({ near: 180, far: 400 });
    expect(aerialFogRange(0)).toEqual({ near: 0, far: 0 });
  });
});

describe("fogWarmMix", () => {
  const sunLength = Math.hypot(SUN_OFFSET.x, SUN_OFFSET.y);
  const sunX = SUN_OFFSET.x / sunLength;
  const sunY = SUN_OFFSET.y / sunLength;

  it("warms toward the sun more than away from it", () => {
    const toward = fogWarmMix(sunX, sunY, SUN_OFFSET.x, SUN_OFFSET.y);
    const away = fogWarmMix(-sunX, -sunY, SUN_OFFSET.x, SUN_OFFSET.y);

    expect(toward).toBeCloseTo(0.2);
    expect(away).toBeCloseTo(0);
    expect(toward).toBeGreaterThan(away);
  });

  it("sits at the midpoint when perpendicular to the sun", () => {
    expect(fogWarmMix(-sunY, sunX, SUN_OFFSET.x, SUN_OFFSET.y)).toBeCloseTo(0.1);
  });

  it("normalizes the forward vector and stays inside the 0..0.2 clamp", () => {
    const scaled = fogWarmMix(sunX * 37, sunY * 37, SUN_OFFSET.x, SUN_OFFSET.y);
    expect(scaled).toBeCloseTo(0.2);

    for (const angle of [0, 0.5, 1.5, 3, 4.5, 6]) {
      const mix = fogWarmMix(Math.cos(angle), Math.sin(angle), SUN_OFFSET.x, SUN_OFFSET.y);
      expect(mix).toBeGreaterThanOrEqual(0);
      expect(mix).toBeLessThanOrEqual(0.2);
    }
  });
});

describe("FogOverlay wiring", () => {
  it("creates the scene fog and overlay mesh", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const overlay = new FogOverlay(scene, camera);

    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    const sceneFog = scene.fog as THREE.Fog;
    expect(sceneFog.near).toBe(1400);
    expect(sceneFog.far).toBe(3300);

    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.layers.isEnabled(OVERLAY_LAYER)).toBe(true);
    expect(mesh.position.toArray()).toEqual([
      (WORLD_WIDTH * gridSize) / 2,
      -(WORLD_HEIGHT * gridSize) / 2,
      50,
    ]);

    overlay.dispose();
    expect(scene.fog).toBeNull();
    expect(scene.children).toHaveLength(0);
  });

  it("follows the player, hides for spectators and updates the fog range", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const overlay = new FogOverlay(scene, camera);
    const mesh = scene.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;

    overlay.update({ camX: 10, camY: 20, myId: "p", fogRadiusWorld: 400 });
    expect(mesh.visible).toBe(true);
    expect(mesh.position.toArray()).toEqual([10, 20, 5]);
    expect(material.uniforms.uHeadPos.value.x).toBe(10);
    expect(material.uniforms.uHeadPos.value.y).toBe(20);
    expect(material.uniforms.uRadius.value).toBe(400);

    overlay.update({ myId: "spectator_id" });
    expect(mesh.visible).toBe(false);

    overlay.updateAerialFog(100);
    const sceneFog = scene.fog as THREE.Fog;
    expect(sceneFog.near).toBe(180);
    expect(sceneFog.far).toBe(400);

    overlay.dispose();
  });
});
