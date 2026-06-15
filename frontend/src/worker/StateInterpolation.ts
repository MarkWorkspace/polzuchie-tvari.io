// ROLE: Очередь состояний, интерполяция между тиками.

import type { GameState } from "../types/game";

export class StateInterpolator {
  private queue: { time: number; state: GameState }[] = [];
  private renderTime: number | null = null;

  public pushState(state: GameState, timestamp: number = Date.now()) {
    this.queue.push({ time: timestamp, state });
    if (this.queue.length > 4) {
      this.queue.shift();
    }
  }

  public clear() {
    this.queue = [];
    this.renderTime = null;
  }

  public interpolate(dt: number, tickRate: number): {
    state: GameState;
    lastState: GameState;
    progress: number;
  } | null {
    if (this.queue.length === 0) return null;
    const tickMs = 1000 / tickRate;

    if (this.queue.length >= 2) {
      const targetDelay = 3.0 * tickMs;
      if (this.renderTime === null) {
        this.renderTime = this.queue[this.queue.length - 1].time - targetDelay;
      }

      const newestTime = this.queue[this.queue.length - 1].time;
      const oldestTime = this.queue[0].time;

      const currentDelay = newestTime - this.renderTime;
      const error = currentDelay - targetDelay;
      let playbackSpeed = 1.0 + error * 0.005;
      playbackSpeed = Math.max(0.5, Math.min(1.5, playbackSpeed));

      if (this.renderTime < oldestTime) this.renderTime = oldestTime;
      if (this.renderTime > newestTime) {
        this.renderTime = newestTime;
        playbackSpeed = 0.0;
      }

      this.renderTime += dt * 1000 * playbackSpeed;
      return this._performInterpolation(this.renderTime);
    }

    const singleState = this.queue[0].state;
    return { state: singleState, lastState: singleState, progress: 1.0 };
  }

  private _performInterpolation(renderTime: number): { state: GameState; lastState: GameState; progress: number } {
    let indexA = this.queue.length - 2;
    for (let i = 0; i < this.queue.length - 1; i++) {
      if (renderTime <= this.queue[i + 1].time) {
        indexA = i;
        break;
      }
    }

    const stateA = this.queue[indexA].state;
    const stateB = this.queue[indexA + 1].state;
    const timeA = this.queue[indexA].time;
    const timeB = this.queue[indexA + 1].time;

    const denom = timeB - timeA;
    const progress = denom > 0.001 ? Math.max(0.0, Math.min(1.0, (renderTime - timeA) / denom)) : 1.0;

    return { state: stateB, lastState: stateA, progress };
  }
}
