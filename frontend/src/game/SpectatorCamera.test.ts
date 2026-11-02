// @vitest-environment jsdom
// ROLE: Tests for spectator free-camera drag, pinch zoom and pointer cleanup.
import type * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import { SpectatorCamera } from "./SpectatorCamera";

function pointerEvent(
  type: string,
  init: { id: number; x: number; y: number; pointerType?: string; button?: number },
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x,
    clientY: init.y,
    button: init.button ?? 0,
  });
  Object.defineProperty(event, "pointerId", { value: init.id });
  Object.defineProperty(event, "pointerType", { value: init.pointerType ?? "touch" });
  return event as PointerEvent;
}

interface StubCamera {
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  up: { set(x: number, y: number, z: number): void };
  lookAt(): void;
  updateProjectionMatrix(): void;
  fov: number;
  near: number;
  far: number;
}

function stubCamera(): StubCamera {
  return {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    up: {
      set() {},
    },
    lookAt() {},
    updateProjectionMatrix() {},
    fov: 60,
    near: 1,
    far: 10000,
  };
}

let container: HTMLDivElement | null = null;
let camera: SpectatorCamera | null = null;

afterEach(() => {
  camera?.destroy();
  camera = null;
  container?.remove();
  container = null;
});

function setup(): { container: HTMLDivElement; camera: SpectatorCamera } {
  container = document.createElement("div");
  document.body.appendChild(container);
  camera = new SpectatorCamera(container);
  return { container, camera };
}

describe("SpectatorCamera", () => {
  it("pans the free camera on a one-finger pointer drag", () => {
    const scene = setup();
    const before = scene.camera.getViewPosition();

    scene.container.dispatchEvent(pointerEvent("pointerdown", { id: 1, x: 100, y: 100 }));
    window.dispatchEvent(pointerEvent("pointermove", { id: 1, x: 160, y: 100 }));

    const after = scene.camera.getViewPosition();
    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBe(before.y);

    window.dispatchEvent(pointerEvent("pointerup", { id: 1, x: 160, y: 100 }));
    const stopped = scene.camera.getViewPosition();
    window.dispatchEvent(pointerEvent("pointermove", { id: 1, x: 220, y: 100 }));
    expect(scene.camera.getViewPosition()).toEqual(stopped);
  });

  it("pinch-zooms with two pointers", () => {
    const scene = setup();
    const cameraStub = stubCamera();

    scene.camera.update(cameraStub as unknown as THREE.PerspectiveCamera, 0);
    const beforeZoom = cameraStub.position.z;

    scene.container.dispatchEvent(pointerEvent("pointerdown", { id: 1, x: 100, y: 100 }));
    scene.container.dispatchEvent(pointerEvent("pointerdown", { id: 2, x: 200, y: 100 }));
    window.dispatchEvent(pointerEvent("pointermove", { id: 2, x: 300, y: 100 }));

    scene.camera.update(cameraStub as unknown as THREE.PerspectiveCamera, 0);
    expect(cameraStub.position.z).toBeLessThan(beforeZoom);
  });

  it("ignores non-primary mouse buttons", () => {
    const scene = setup();
    const before = scene.camera.getViewPosition();

    scene.container.dispatchEvent(
      pointerEvent("pointerdown", { id: 1, x: 100, y: 100, pointerType: "mouse", button: 2 }),
    );
    window.dispatchEvent(pointerEvent("pointermove", { id: 1, x: 160, y: 100 }));

    expect(scene.camera.getViewPosition()).toEqual(before);
  });
});
