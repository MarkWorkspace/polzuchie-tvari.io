// ROLE: Unit tests for the snake-light pool selection and visibility.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SnakeLightPool } from "./SnakeLightPool";

describe("SnakeLightPool", () => {
  it("prioritizes the local player and respects the active count", () => {
    const scene = new THREE.Scene();
    const pool = new SnakeLightPool(scene, 2);

    pool.update(
      [
        { hx: 40, hy: 0, glowColor: 0xff0000, isMe: false },
        { hx: 0, hy: 0, glowColor: 0x00ff00, isMe: true },
        { hx: 20, hy: 0, glowColor: 0x0000ff, isMe: false },
      ],
      0,
      0,
    );

    const lights = scene.children.filter(
      (child): child is THREE.PointLight => child instanceof THREE.PointLight,
    );
    expect(lights).toHaveLength(4);
    expect(lights.filter((light) => light.visible)).toHaveLength(2);
    expect(lights[0].position.x).toBe(0);
    expect(lights[0].color.getHex()).toBe(0x00ff00);
    expect(lights[1].position.x).toBe(20);

    pool.setCount(0);
    expect(lights.every((light) => !light.visible)).toBe(true);

    pool.destroy();
    expect(scene.children.filter((child) => child instanceof THREE.PointLight)).toHaveLength(0);
  });
});
