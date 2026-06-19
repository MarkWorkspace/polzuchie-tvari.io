// ROLE: Клиентское предсказание позиции камеры.

import type { GameState } from "../types/game";
import { toroidalLerp } from "./shared/MathUtils";

export class CameraPredictor {
  public localAngle = 0.0;
  public localX = 0.0;
  public localY = 0.0;
  public currentZoomOffset = 0.0;
  public myVisualOffsetX = 0.0;
  public myVisualOffsetY = 0.0;
  private isInitialized = false;

  public reset() {
    this.localAngle = 0.0;
    this.localX = 0.0;
    this.localY = 0.0;
    this.currentZoomOffset = 0.0;
    this.myVisualOffsetX = 0.0;
    this.myVisualOffsetY = 0.0;
    this.isInitialized = false;
  }

  public predict(
    dt: number,
    myId: string,
    localInput: any,
    state: GameState,
    lastState: GameState | null,
    progress: number,
    gridSize: number
  ): { camX: number; camY: number; camAngle: number } {
    const mapW = state.server_world?.width ?? 100;
    const mapH = state.server_world?.height ?? 100;
    const myPlayer = state.players[myId];

    if (!myPlayer) {
      return {
        camX: (mapW * gridSize) / 2,
        camY: -(mapH * gridSize) / 2,
        camAngle: 0.0,
      };
    }

    if (!this.isInitialized) {
      this.localAngle = myPlayer.angle;
      this.localX = myPlayer.body && myPlayer.body.length >= 2 ? myPlayer.body[0] : 0.0;
      this.localY = myPlayer.body && myPlayer.body.length >= 2 ? myPlayer.body[1] : 0.0;
      this.isInitialized = true;
    }

    if (myPlayer.is_dead) {
      return {
        camX: this.localX * gridSize + gridSize / 2,
        camY: -(this.localY * gridSize + gridSize / 2),
        camAngle: this.localAngle,
      };
    }

    this._interpolateAngle(myPlayer, lastState, myId, progress, mapW, mapH);
    this._predictPosition(dt, myId, myPlayer, localInput, state, lastState, progress, mapW, mapH);

    // Apply wrap corrections
    if (this.localX < 0) this.localX += mapW;
    if (this.localX >= mapW) this.localX -= mapW;
    if (this.localY < 0) this.localY += mapH;
    if (this.localY >= mapH) this.localY -= mapH;

    return {
      camX: this.localX * gridSize + gridSize / 2,
      camY: -(this.localY * gridSize + gridSize / 2),
      camAngle: this.localAngle,
    };
  }

  private _interpolateAngle(
    myPlayer: any,
    lastState: GameState | null,
    myId: string,
    progress: number,
    mapW: number,
    mapH: number
  ) {
    const lastPlayer = lastState?.players[myId];

    if (!lastPlayer || lastPlayer.is_dead || !lastPlayer.body || lastPlayer.body.length < 4 || !myPlayer.body || myPlayer.body.length < 4) {
      this.localAngle = myPlayer.angle;
      return;
    }

    // Interpolate head position (segment 0)
    const bx0 = myPlayer.body[0];
    const by0 = myPlayer.body[1];
    const ox0 = lastPlayer.body[0];
    const oy0 = lastPlayer.body[1];

    const dx0 = bx0 - ox0;
    const dy0 = by0 - oy0;
    const isTeleportHead = (dx0 * dx0 + dy0 * dy0) > 36.0;

    // Interpolate neck position (segment 1)
    const bx1 = myPlayer.body[2];
    const by1 = myPlayer.body[3];
    const ox1 = lastPlayer.body[2];
    const oy1 = lastPlayer.body[3];

    const dx1 = bx1 - ox1;
    const dy1 = by1 - oy1;
    const isTeleportNeck = (dx1 * dx1 + dy1 * dy1) > 36.0;

    if (isTeleportHead || isTeleportNeck) {
      this.localAngle = myPlayer.angle;
      return;
    }

    const x0 = toroidalLerp(ox0, bx0, progress, mapW);
    const y0 = toroidalLerp(oy0, by0, progress, mapH);
    const x1 = toroidalLerp(ox1, bx1, progress, mapW);
    const y1 = toroidalLerp(oy1, by1, progress, mapH);

    let dx = x0 - x1;
    let dy = y0 - y1;

    // Toroidal correction for displacement vector
    if (dx > mapW / 2) dx -= mapW;
    else if (dx < -mapW / 2) dx += mapW;

    if (dy > mapH / 2) dy -= mapH;
    else if (dy < -mapH / 2) dy += mapH;

    // Convert to visual coordinates (where Y is negated) and compute angle
    const visualDx = dx;
    const visualDy = -dy;

    const visAngle = Math.atan2(visualDy, visualDx);

    // Server angle space is negated visual angle
    this.localAngle = -visAngle;
  }



  private _predictPosition(
    dt: number,
    myId: string,
    myPlayer: any,
    localInput: any,
    state: GameState,
    lastState: GameState | null,
    progress: number,
    mapW: number,
    mapH: number
  ) {
    if (myPlayer.accelerating || localInput.accelerating) {
      this.currentZoomOffset = Math.min(1, this.currentZoomOffset + 3.0 * dt);
    } else {
      this.currentZoomOffset = Math.max(0, this.currentZoomOffset - 3.0 * dt);
    }

    const targetX = myPlayer.body[0];
    const targetY = myPlayer.body[1];
    let startX = targetX;
    let startY = targetY;
    const oldBody = lastState?.players[myId]?.body;
    if (oldBody && oldBody.length >= 2) {
      startX = oldBody[0];
      startY = oldBody[1];
    }

    const camDx = targetX - startX;
    const camDy = targetY - startY;
    let serverX = targetX;
    let serverY = targetY;

    if (camDx * camDx + camDy * camDy <= 36.0) {
      serverX = toroidalLerp(startX, targetX, progress, mapW);
      serverY = toroidalLerp(startY, targetY, progress, mapH);
    }

    if ((myPlayer.teleport_state === "entering" || myPlayer.teleport_state === "in_transit") && myPlayer.teleport_out_x !== undefined && myPlayer.teleport_out_y !== undefined) {
      this._predictTeleportPosition(dt, myPlayer, serverX, serverY, mapW, mapH, state);
    } else {
      this._predictNormalPosition(dt, myPlayer, localInput, serverX, serverY, mapW, mapH, state);
    }

    if (myPlayer.teleport_state === "entering" || myPlayer.teleport_state === "in_transit") {
      this.myVisualOffsetX = 0;
      this.myVisualOffsetY = 0;
    } else {
      this.myVisualOffsetX = this.localX - serverX;
      if (this.myVisualOffsetX > mapW / 2) this.myVisualOffsetX -= mapW;
      else if (this.myVisualOffsetX < -mapW / 2) this.myVisualOffsetX += mapW;

      this.myVisualOffsetY = this.localY - serverY;
      if (this.myVisualOffsetY > mapH / 2) this.myVisualOffsetY -= mapH;
      else if (this.myVisualOffsetY < -mapH / 2) this.myVisualOffsetY += mapH;
    }
  }

  private _predictTeleportPosition(dt: number, myPlayer: any, serverX: number, serverY: number, mapW: number, mapH: number, state: GameState) {
    serverX = myPlayer.teleport_out_x;
    serverY = myPlayer.teleport_out_y;
    
    if (Math.abs(this.localX - serverX) > mapW / 2) {
      this.localX += this.localX < serverX ? mapW : -mapW;
    }
    if (Math.abs(this.localY - serverY) > mapH / 2) {
      this.localY += this.localY < serverY ? mapH : -mapH;
    }

    const ratio = Math.max(0.001, myPlayer.teleport_timer_ratio ?? 0.001);
    const delay = (state.server_world?.portals_teleport_delay_ms ?? 1500) / 1000.0;
    const timeRemaining = ratio * delay;
    
    if (timeRemaining > dt && timeRemaining > 0.05) {
      const moveRatio = Math.min(1.0, dt / timeRemaining);
      this.localX += (serverX - this.localX) * moveRatio;
      this.localY += (serverY - this.localY) * moveRatio;
    } else {
      this.localX = serverX;
      this.localY = serverY;
    }
  }

  private _predictNormalPosition(_dt: number, _myPlayer: any, _localInput: any, serverX: number, serverY: number, _mapW: number, _mapH: number, _state: GameState) {
    // Item 19: Remove double-smoothing. serverX/Y are already smoothly interpolated
    // using progress. Prediction + EMA creates lag. We just snap to the interpolated target.
    this.localX = serverX;
    this.localY = serverY;
  }
}
