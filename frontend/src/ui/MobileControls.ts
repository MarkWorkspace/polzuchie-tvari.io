// ROLE: Мобильные элементы управления.
import { InputManager } from "../game/InputManager";

export class MobileControls {
  private container: HTMLDivElement;
  private inputManager: InputManager;
  private boostZone: HTMLDivElement | null = null;

  private steeringTouchId: number | null = null;
  private boostTouchId: number | null = null;
  private isSteeringFingerBoosting = false;

  constructor(container: HTMLDivElement, inputManager: InputManager) {
    this.container = container;
    this.inputManager = inputManager;

    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth <= 768;
    if (isMobile) {
      this.render();
      this.bindEvents();
    }
  }

  public destroy(): void {
    window.removeEventListener("touchstart", this.handleTouchStart);
    window.removeEventListener("touchmove", this.handleTouchMove);
    window.removeEventListener("touchend", this.handleTouchEnd);
    window.removeEventListener("touchcancel", this.handleTouchEnd);
    if (this.boostZone) {
      this.boostZone.remove();
      this.boostZone = null;
    }
  }

  private render(): void {
    this.boostZone = document.createElement("div");
    this.boostZone.id = "mobile-boost-zone";
    this.boostZone.className = "hud-interactive";
    this.boostZone.textContent = "Hold here to Boost";
    this.container.appendChild(this.boostZone);
  }

  private bindEvents(): void {
    window.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    window.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    window.addEventListener("touchend", this.handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", this.handleTouchEnd, { passive: false });
  }

  private updateAcceleratingState(): void {
    const isAccelerating = (this.boostTouchId !== null) || this.isSteeringFingerBoosting;
    this.inputManager.setAccelerating(isAccelerating);
  }

  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.boostZone) return;
    const rect = this.boostZone.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;
      if (target && target.tagName !== "CANVAS" && target.id !== "mobile-boost-zone") {
        continue;
      }
      
      if (touch.clientY >= rect.top) {
        if (e.cancelable) e.preventDefault();
        if (this.boostTouchId === null) {
          this.boostTouchId = touch.identifier;
          this.updateAcceleratingState();
        }
      } else {
        const target = touch.target as HTMLElement;
        if (this.steeringTouchId === null && target && target.tagName === "CANVAS") {
          if (e.cancelable) e.preventDefault();
          this.steeringTouchId = touch.identifier;
          this.updateSteering(touch.clientX);
        }
      }
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.boostZone) return;
    const rect = this.boostZone.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (touch.identifier === this.steeringTouchId) {
        if (e.cancelable) e.preventDefault();
        this.updateSteering(touch.clientX);

        const isSteeringInBoost = touch.clientY >= rect.top;
        if (isSteeringInBoost !== this.isSteeringFingerBoosting) {
          this.isSteeringFingerBoosting = isSteeringInBoost;
          this.updateAcceleratingState();
        }
      } else if (touch.identifier === this.boostTouchId) {
        if (e.cancelable) e.preventDefault();
        const isStillInBoost = touch.clientY >= rect.top;
        if (!isStillInBoost) {
          this.boostTouchId = null;
          this.updateAcceleratingState();
        }
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      if (touch.identifier === this.steeringTouchId) {
        this.steeringTouchId = null;
        this.isSteeringFingerBoosting = false;
        this.inputManager.setTurn(0.0);
        this.updateAcceleratingState();
      }
      if (touch.identifier === this.boostTouchId) {
        this.boostTouchId = null;
        this.updateAcceleratingState();
      }
    }
  };

  private updateSteering(clientX: number): void {
    const normTouchX = (clientX / window.innerWidth) * 2 - 1;
    // Apply dead zone (5% of screen width)
    const deadZone = 0.05;
    if (Math.abs(normTouchX) < deadZone) {
      this.inputManager.setTurn(0.0);
      return;
    }
    
    const sensitivity = this.inputManager.getMouseSensitivity() || 1.0;
    const targetDeflection = 0.5 * sensitivity;
    
    // Scale the turn beyond the deadzone
    const activeRange = 1.0 - deadZone;
    const sign = Math.sign(normTouchX);
    const activeNormX = (Math.abs(normTouchX) - deadZone) / activeRange * sign;
    
    this.inputManager.setTurn(activeNormX / targetDeflection);
  }
}
