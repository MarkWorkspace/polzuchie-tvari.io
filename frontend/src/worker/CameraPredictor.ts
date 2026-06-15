// ROLE: Клиентское предсказание позиции камеры.

import type { GameState } from "../types/game";
import { frameSmoothing, toroidalLerp } from "./shared/MathUtils";

export class CameraPredictor {
  public localAngle = 0.0;
  public localX = 0.0;
  public localY = 0.0;
  public localCurrentTurn = 0.0;
  public currentZoomOffset = 0.0;
  public myVisualOffsetX = 0.0;
  public myVisualOffsetY = 0.0;
  private isInitialized = false;

  public reset() {
    this.localAngle = 0.0;
    this.localX = 0.0;
    this.localY = 0.0;
    this.localCurrentTurn = 0.0;
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
      this.localX = myPlayer.body && myPlayer.body[0] ? myPlayer.body[0].x : 0.0;
      this.localY = myPlayer.body && myPlayer.body[0] ? myPlayer.body[0].y : 0.0;
      this.isInitialized = true;
    }

    if (myPlayer.is_dead) {
      return {
        camX: this.localX * gridSize + gridSize / 2,
        camY: -(this.localY * gridSize + gridSize / 2),
        camAngle: this.localAngle,
      };
    }

    const tickRate = state.server_simulation?.tick_rate ?? 30;
    this._predictAngle(dt, myPlayer, localInput, state, tickRate, mapW, mapH);
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

  private _predictAngle(
    dt: number,
    myPlayer: any,
    localInput: any,
    state: GameState,
    tickRate: number,
    mapW: number,
    mapH: number
  ) {
    const baseHeadRadius = state.server_snake?.base_head_radius ?? 0.2;
    const scoreThicknessScale = state.server_snake?.score_thickness_scale ?? 0.0005;
    const startLength = state.server_snake?.start_length ?? 5;
    const myLength = myPlayer.body ? myPlayer.body.length : startLength;
    const myGained = Math.max(0, myLength - startLength);

    const minTurnRadius = state.server_simulation?.min_turn_radius ?? 0.5;
    const turnCoeff = state.server_simulation?.turn_radius_thickness_coeff ?? 1.0;
    const maxTurnSpeed = state.server_simulation?.max_turn_speed_deg_per_second ?? 290.0;
    const baseSpeed = state.server_simulation?.base_speed_per_second ?? 6.0;

    const myHeadRadius = baseHeadRadius + (myGained * 10.0) * scoreThicknessScale;
    const effRadius = minTurnRadius + myHeadRadius * turnCoeff;
    const maxTurn = baseSpeed / Math.max(effRadius, 0.01);
    const turnPerTick = Math.min(maxTurnSpeed * Math.PI / 180, maxTurn) / tickRate;

    if (!myPlayer.teleport_state || myPlayer.teleport_state === "none" || myPlayer.teleport_state === "exiting") {
      const targetTurn = localInput.turn * turnPerTick;
      if (localInput.mode === "mouse" || localInput.mode === "tilt") {
        this.localCurrentTurn = targetTurn;
      } else {
        const smoothing = localInput.turn === 0 ? (state.server_simulation?.turn_idle_smoothing_at_20hz ?? 0.3) : (state.server_simulation?.turn_active_smoothing_at_20hz ?? 0.15);
        this.localCurrentTurn += (targetTurn - this.localCurrentTurn) * frameSmoothing(smoothing, dt);
      }
      this.localAngle += this.localCurrentTurn * dt * tickRate;
    } else {
      this.localCurrentTurn = 0.0;
    }

    this._applyGravityBending(dt, myPlayer, state, mapW, mapH);

    const angleDiff = Math.atan2(Math.sin(myPlayer.angle - this.localAngle), Math.cos(myPlayer.angle - this.localAngle));
    this.localAngle += Math.abs(angleDiff) > Math.PI / 2 ? angleDiff : angleDiff * 0.1;
  }

  private _applyGravityBending(dt: number, myPlayer: any, state: GameState, mapW: number, mapH: number) {
    if (state.server_world?.black_holes_enabled === 0 || !state.black_holes || !myPlayer.body) return;
    const head = myPlayer.body[0];
    let gravityBend = 0.0;

    for (let i = 0; i < state.black_holes.length; i++) {
      const bh = state.black_holes[i];
      if (!bh || bh.state === "dead" || (bh.current_scale ?? 1.0) <= 0.01) continue;

      let bhDx = bh.x - head.x;
      if (bhDx > mapW / 2) bhDx -= mapW;
      else if (bhDx < -mapW / 2) bhDx += mapW;

      let bhDy = bh.y - head.y;
      if (bhDy > mapH / 2) bhDy -= mapH;
      else if (bhDy < -mapH / 2) bhDy += mapH;

      const dist = Math.sqrt(bhDx * bhDx + bhDy * bhDy);
      const effPullRadius = bh.pull_radius * (bh.current_scale ?? 1.0);

      if (dist > 0.001 && dist < effPullRadius) {
        const pullDistFactor = (effPullRadius - dist) / effPullRadius;
        const targetAngle = Math.atan2(bhDy, bhDx);
        const angleDiffBend = Math.atan2(Math.sin(targetAngle - this.localAngle), Math.cos(targetAngle - this.localAngle));

        const pullForce = state.server_world?.black_holes_pull_force ?? 6.0;
        const bendSpeed = pullForce * (bh.current_scale ?? 1.0) * pullDistFactor * 5.0 * dt;

        gravityBend += angleDiffBend > 0 ? Math.min(angleDiffBend, bendSpeed) : Math.max(angleDiffBend, -bendSpeed);
      }
    }
    this.localAngle += gravityBend;
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

    const target = myPlayer.body[0];
    let start = target;
    const oldBody = lastState?.players[myId]?.body;
    if (oldBody && oldBody.length > 0) start = oldBody[0];

    const camDx = target.x - start.x;
    const camDy = target.y - start.y;
    let serverX = target.x;
    let serverY = target.y;

    if (camDx * camDx + camDy * camDy <= 36.0) {
      serverX = toroidalLerp(start.x, target.x, progress, mapW);
      serverY = toroidalLerp(start.y, target.y, progress, mapH);
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
