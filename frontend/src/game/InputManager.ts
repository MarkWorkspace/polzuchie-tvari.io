// ROLE: Ввод с клавиатуры, мыши, тача, гироскопа. Не UI, не сеть.
export type ControlMode = "keyboard" | "mouse" | "tilt";

const GAME_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

/**
 * True when the event target belongs to a UI surface that owns its own input:
 * form controls, contenteditable, or any HUD widget marked `.hud-interactive`.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(".hud-interactive")) return true;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  if (element.closest('[contenteditable]:not([contenteditable="false"])')) return true;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

export class InputManager {
  private turn = 0.0;
  private accelerating = false;
  private controlMode: ControlMode = "keyboard";
  private isMobile = false;
  private pressedKeys = new Set<string>();
  private calibrationGamma: number | null = null;
  private uiOpen = false;

  private onControlModeChangeCallback?: (mode: ControlMode) => void;
  private onInputUpdateCallback?: () => void;
  private mouseSensitivity = 1.0;

  constructor() {
    this.detectDevice();
    this.bindEvents();
  }

  private detectDevice(): void {
    this.isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;
    this.controlMode = this.isMobile ? "mouse" : "keyboard";
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("mousemove", this.handleMouseMove, true);
    window.addEventListener("blur", this.handleWindowBlur, true);
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", this.handleDeviceOrientation, true);
    }
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("mousemove", this.handleMouseMove, true);
    window.removeEventListener("blur", this.handleWindowBlur, true);
    window.removeEventListener("deviceorientation", this.handleDeviceOrientation, true);
  }

  public setCallbacks(callbacks: {
    onControlModeChange?: (mode: ControlMode) => void;
    onInputUpdate?: () => void;
  }): void {
    this.onControlModeChangeCallback = callbacks.onControlModeChange;
    this.onInputUpdateCallback = callbacks.onInputUpdate;
  }

  public getTurn(): number {
    return this.turn;
  }

  public setTurn(value: number): void {
    const prev = this.turn;
    this.turn = Math.max(-1.0, Math.min(1.0, value));
    if (this.turn !== prev) this.onInputUpdateCallback?.();
  }

  public isAccelerating(): boolean {
    return this.accelerating;
  }

  public setAccelerating(val: boolean): void {
    const prev = this.accelerating;
    this.accelerating = val;
    if (this.accelerating !== prev) this.onInputUpdateCallback?.();
  }

  public getControlMode(): ControlMode {
    return this.controlMode;
  }

  public setControlMode(mode: ControlMode): void {
    if (this.controlMode === mode) return;
    this.controlMode = mode;
    if (mode === "tilt") {
      this.calibrationGamma = null;
    }
    this.clearInputState();
    this.onControlModeChangeCallback?.(mode);
    this.onInputUpdateCallback?.();
  }

  /** While a modal/drawer owns input, game keys and mouse steering are ignored. */
  public setUiOpen(open: boolean): void {
    if (this.uiOpen === open) return;
    this.uiOpen = open;
    if (open) this.resyncInput();
  }

  public isUiOpen(): boolean {
    return this.uiOpen;
  }

  /**
   * Release everything the server may still consider pressed. Keeps the
   * control mode and mouse sensitivity (they are settings, not held input).
   */
  public resyncInput(): void {
    this.clearInputState();
    this.onInputUpdateCallback?.();
  }

  private clearInputState(): void {
    this.pressedKeys.clear();
    this.accelerating = false;
    this.turn = 0.0;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    // UI and editable widgets own their keyboard events; never prevent or stop
    // them, otherwise Escape/Space/arrows break inside the settings drawer.
    if (this.uiOpen || isEditableTarget(e.target)) return;

    // Prevent default to stop scrolling, even on repeated keys
    if (GAME_KEYS.includes(e.code)) {
      e.preventDefault();
    }

    const isSteeringKey =
      this.controlMode === "keyboard" &&
      ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code);

    // A key held across a resync only produces repeat events. Rebuild the held
    // state from them (idempotently), so "hold Space/arrow through respawn or
    // reconnect" works without the repeat-induced lag the early return avoided.
    if (e.repeat) {
      if (isSteeringKey) {
        this.pressedKeys.add(e.code);
        this.recalculateTurn();
      } else if (e.code === "Space" && !this.accelerating) {
        this.accelerating = true;
        this.onInputUpdateCallback?.();
      }
      return;
    }

    e.stopPropagation();

    if (e.code === "KeyT") {
      this.setControlMode(this.controlMode === "keyboard" ? "mouse" : "keyboard");
      return;
    }
    if (isSteeringKey) {
      this.pressedKeys.add(e.code);
      this.recalculateTurn();
    }
    if (e.code === "Space") {
      this.accelerating = true;
      this.onInputUpdateCallback?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (this.uiOpen || isEditableTarget(e.target)) return;
    if (GAME_KEYS.includes(e.code)) {
      e.preventDefault();
    }
    e.stopPropagation();

    if (
      this.controlMode === "keyboard" &&
      ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)
    ) {
      this.pressedKeys.delete(e.code);
      this.recalculateTurn();
    }
    if (e.code === "Space") {
      this.accelerating = false;
      this.onInputUpdateCallback?.();
    }
  };

  private handleWindowBlur = (): void => {
    this.resyncInput();
  };

  private recalculateTurn(): void {
    const left = this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA");
    const right = this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD");
    const targetTurn = left && !right ? -1.0 : right && !left ? 1.0 : 0.0;
    if (this.turn !== targetTurn) {
      this.turn = targetTurn;
      this.onInputUpdateCallback?.();
    }
  }

  public setMouseSensitivity(val: number): void {
    this.mouseSensitivity = val;
  }

  public getMouseSensitivity(): number {
    return this.mouseSensitivity;
  }

  private handleMouseMove = (e: MouseEvent): void => {
    // Mouse movement over HUD panels must not steer the snake.
    if (this.uiOpen || isEditableTarget(e.target)) return;
    if (this.controlMode !== "mouse" || this.isMobile) return;
    e.stopPropagation();
    const normX = (e.clientX / window.innerWidth) * 2 - 1;
    const targetDeflection = 0.5 * this.mouseSensitivity;
    this.turn = Math.max(-1.0, Math.min(1.0, normX / targetDeflection));
    this.onInputUpdateCallback?.();
  };

  private handleDeviceOrientation = (e: DeviceOrientationEvent): void => {
    if (this.controlMode !== "tilt" || e.gamma === null) return;

    if (this.calibrationGamma === null) {
      this.calibrationGamma = e.gamma;
    }

    let diff = e.gamma - this.calibrationGamma;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const maxRoll = 30;
    const roll = Math.max(-maxRoll, Math.min(maxRoll, diff));
    this.turn = Math.abs(roll) < 5 ? 0 : (roll > 0 ? roll - 5 : roll + 5) / (maxRoll - 5);
    this.onInputUpdateCallback?.();
  };
}
