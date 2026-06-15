// ROLE: Ввод с клавиатуры, мыши, тача, гироскопа. Не UI, не сеть.
export type ControlMode = "keyboard" | "mouse" | "tilt";

export class InputManager {
  private turn = 0.0;
  private accelerating = false;
  private controlMode: ControlMode = "keyboard";
  private isMobile = false;
  private pressedKeys = new Set<string>();
  private calibrationGamma: number | null = null;

  private onControlModeChangeCallback?: (mode: ControlMode) => void;
  private onInputUpdateCallback?: () => void;
  private mouseSensitivity = 1.0;

  constructor() {
    this.detectDevice();
    this.bindEvents();
  }

  private detectDevice(): void {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.controlMode = this.isMobile ? "mouse" : "keyboard";
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("blur", this.handleWindowBlur);
    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", this.handleDeviceOrientation);
    }
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("deviceorientation", this.handleDeviceOrientation);
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
    this.pressedKeys.clear();
    this.accelerating = false;
    this.turn = 0.0;
    this.onControlModeChangeCallback?.(mode);
    this.onInputUpdateCallback?.();
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyT") {
      this.setControlMode(this.controlMode === "keyboard" ? "mouse" : "keyboard");
      return;
    }
    if (this.controlMode === "keyboard" && ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)) {
      this.pressedKeys.add(e.code);
      this.recalculateTurn();
    }
    if (e.code === "Space") {
      this.accelerating = true;
      this.onInputUpdateCallback?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (this.controlMode === "keyboard" && ["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)) {
      this.pressedKeys.delete(e.code);
      this.recalculateTurn();
    }
    if (e.code === "Space") {
      this.accelerating = false;
      this.onInputUpdateCallback?.();
    }
  };

  private handleWindowBlur = (): void => {
    this.pressedKeys.clear();
    this.accelerating = false;
    if (this.turn !== 0.0) {
      this.turn = 0.0;
      this.onInputUpdateCallback?.();
    }
  };

  private recalculateTurn(): void {
    const left = this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA");
    const right = this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD");
    const targetTurn = left && !right ? -1.0 : (right && !left ? 1.0 : 0.0);
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
    if (this.controlMode !== "mouse" || this.isMobile) return;
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
    this.turn = Math.abs(roll) < 5 ? 0 : (roll > 0 ? (roll - 5) : (roll + 5)) / (maxRoll - 5);
    this.onInputUpdateCallback?.();
  };
}
