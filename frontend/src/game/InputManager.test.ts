// @vitest-environment jsdom
// ROLE: Regression tests for input ownership: editable/HUD guards, UI-open pause and resync.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InputManager, isEditableTarget } from "./InputManager";

let manager: InputManager | null = null;

afterEach(() => {
  manager?.destroy();
  manager = null;
  document.body.innerHTML = "";
});

function createManager(): InputManager {
  manager = new InputManager();
  return manager;
}

function dispatchKey(
  target: EventTarget,
  type: "keydown" | "keyup",
  code: string,
  repeat = false,
): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function dispatchMouseMove(target: EventTarget, clientX: number): void {
  target.dispatchEvent(new MouseEvent("mousemove", { clientX, bubbles: true }));
}

describe("isEditableTarget", () => {
  it("recognizes form controls, contenteditable and HUD widgets", () => {
    for (const tag of ["input", "textarea", "select", "button"]) {
      const element = document.createElement(tag);
      document.body.appendChild(element);
      expect(isEditableTarget(element)).toBe(true);
    }

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const editableChild = document.createElement("span");
    editable.appendChild(editableChild);
    document.body.appendChild(editable);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(editableChild)).toBe(true);

    const hud = document.createElement("div");
    hud.className = "hud-interactive";
    const hudChild = document.createElement("span");
    hud.appendChild(hudChild);
    document.body.appendChild(hud);
    expect(isEditableTarget(hud)).toBe(true);
    expect(isEditableTarget(hudChild)).toBe(true);

    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    expect(isEditableTarget(canvas)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("InputManager keyboard ownership", () => {
  it("does not capture Space or prevent default inside a text input", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const inputManager = createManager();

    const event = dispatchKey(input, "keydown", "Space");

    expect(event.defaultPrevented).toBe(false);
    expect(inputManager.isAccelerating()).toBe(false);
  });

  it("does not capture arrows inside a select", () => {
    const select = document.createElement("select");
    document.body.appendChild(select);
    const inputManager = createManager();

    const event = dispatchKey(select, "keydown", "ArrowLeft");

    expect(event.defaultPrevented).toBe(false);
    expect(inputManager.getTurn()).toBe(0);
  });

  it("captures Space and arrows on the game canvas", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const inputManager = createManager();

    const spaceDown = dispatchKey(canvas, "keydown", "Space");
    expect(spaceDown.defaultPrevented).toBe(true);
    expect(inputManager.isAccelerating()).toBe(true);

    const leftDown = dispatchKey(canvas, "keydown", "ArrowLeft");
    expect(leftDown.defaultPrevented).toBe(true);
    expect(inputManager.getTurn()).toBe(-1);

    dispatchKey(canvas, "keyup", "ArrowLeft");
    dispatchKey(canvas, "keyup", "Space");
    expect(inputManager.getTurn()).toBe(0);
    expect(inputManager.isAccelerating()).toBe(false);
  });
});

describe("InputManager UI ownership", () => {
  it("ignores game input while a UI surface is open", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const inputManager = createManager();

    dispatchKey(canvas, "keydown", "ArrowLeft");
    expect(inputManager.getTurn()).toBe(-1);

    inputManager.setUiOpen(true);
    expect(inputManager.isUiOpen()).toBe(true);
    expect(inputManager.getTurn()).toBe(0);

    const blockedSpace = dispatchKey(canvas, "keydown", "Space");
    expect(blockedSpace.defaultPrevented).toBe(false);
    expect(inputManager.isAccelerating()).toBe(false);

    inputManager.setUiOpen(false);
    dispatchKey(canvas, "keydown", "Space");
    expect(inputManager.isAccelerating()).toBe(true);
  });

  it("does not steer from mouse movement over HUD panels", () => {
    const hud = document.createElement("div");
    hud.className = "hud-interactive";
    document.body.appendChild(hud);
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const inputManager = createManager();
    inputManager.setControlMode("mouse");

    dispatchMouseMove(hud, 1000);
    expect(inputManager.getTurn()).toBe(0);

    dispatchMouseMove(canvas, 1000);
    expect(inputManager.getTurn()).toBeGreaterThan(0);
  });
});

describe("InputManager resync", () => {
  it("releases held keys and preserves mode and sensitivity", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const inputManager = createManager();
    const onInputUpdate = vi.fn();
    inputManager.setCallbacks({ onInputUpdate });

    inputManager.setControlMode("mouse");
    inputManager.setMouseSensitivity(2.5);
    dispatchMouseMove(canvas, 1000);
    dispatchKey(canvas, "keydown", "Space");
    expect(inputManager.getTurn()).toBeGreaterThan(0);
    expect(inputManager.isAccelerating()).toBe(true);

    inputManager.resyncInput();

    expect(inputManager.getTurn()).toBe(0);
    expect(inputManager.isAccelerating()).toBe(false);
    expect(inputManager.getControlMode()).toBe("mouse");
    expect(inputManager.getMouseSensitivity()).toBe(2.5);
    expect(onInputUpdate).toHaveBeenCalled();
  });

  it("re-arms still-held keys from repeat events after a resync", () => {
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const inputManager = createManager();

    dispatchKey(canvas, "keydown", "Space");
    dispatchKey(canvas, "keydown", "ArrowLeft");
    inputManager.resyncInput();
    expect(inputManager.isAccelerating()).toBe(false);
    expect(inputManager.getTurn()).toBe(0);

    const spaceRepeat = dispatchKey(canvas, "keydown", "Space", true);
    const leftRepeat = dispatchKey(canvas, "keydown", "ArrowLeft", true);

    expect(spaceRepeat.defaultPrevented).toBe(true);
    expect(leftRepeat.defaultPrevented).toBe(true);
    expect(inputManager.isAccelerating()).toBe(true);
    expect(inputManager.getTurn()).toBe(-1);
  });
});
