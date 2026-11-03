// ROLE: Unit tests for the map-size ground transform and the GroundPlane mesh wiring.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../game/Config";
import { GroundPlane, groundTransform } from "./GroundPlane";
import { QUALITY_PRESETS } from "./RenderQuality";

describe("groundTransform", () => {
  it("centers a square map and keeps the reference scale at 1", () => {
    expect(groundTransform(100, 100)).toEqual({
      x: 1000,
      y: -1000,
      scaleX: 100 / WORLD_WIDTH,
      scaleY: 100 / WORLD_HEIGHT,
    });
  });

  it("handles a non-square map", () => {
    expect(groundTransform(120, 80)).toEqual({
      x: 1200,
      y: -800,
      scaleX: 1.2,
      scaleY: 0.8,
    });
  });
});

describe("GroundPlane wiring", () => {
  it("adds a mesh, toggles receiveShadow and follows the map size", () => {
    const scene = new THREE.Scene();
    const ground = new GroundPlane(scene, QUALITY_PRESETS.low);

    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0] as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.receiveShadow).toBe(false);

    ground.setReceiveShadow(true);
    expect(mesh.receiveShadow).toBe(true);

    ground.update({ gameState: { server_world: { width: 120, height: 80 } } });
    expect(mesh.position.toArray()).toEqual([1200, -800, -2]);
    expect(mesh.scale.toArray()).toEqual([1.2, 0.8, 1]);

    ground.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
