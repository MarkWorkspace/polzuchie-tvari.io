// ROLE: Очередь состояний и интерполяция между тиками. Адаптирует задержку 2–3 тика по джиттеру прихода кадров. Не сеть и не рендер.

import type { GameState } from "../types/game";

const MAX_QUEUE = 20;
const MIN_TARGET_DELAY_TICKS = 2;
const MAX_TARGET_DELAY_TICKS = 3;
/** Jitter above this fraction of a tick raises the delay to 3 ticks. */
const HIGH_JITTER_FRACTION = 0.35;
/** Jitter below this fraction of a tick lowers the delay back to 2 ticks. */
const LOW_JITTER_FRACTION = 0.15;
/** Ignore tab-suspend-sized gaps when estimating network jitter. */
const MAX_JITTER_SAMPLE_MS = 500;
const JITTER_EMA_ALPHA = 0.2;

export class StateInterpolator {
  private queue: { time: number; state: GameState }[] = [];
  private renderTime: number | null = null;
  private lastArrivalTime: number | null = null;
  private jitterMs = 0;
  private targetDelayTicks = MIN_TARGET_DELAY_TICKS;

  public pushState(state: GameState, timestamp: number = Date.now()) {
    const tickMs = 1000 / (state.server_tick_rate || 30);
    this._sampleJitter(timestamp, tickMs);

    let idealTime = timestamp;
    if (this.queue.length > 0) {
      const lastIdeal = this.queue[this.queue.length - 1].time;
      idealTime = lastIdeal + tickMs;

      // Softly lock to actual timestamp to prevent clock drift over time,
      // but snap if the drift is too large (e.g., lag spike or tab inactive)
      const drift = timestamp - idealTime;
      if (Math.abs(drift) > 200) {
        idealTime = timestamp; // Snap to reality
      } else {
        idealTime += drift * 0.1; // Filter out 90% of high-frequency network jitter
      }
    }

    this.queue.push({ time: idealTime, state });
    if (this.queue.length > MAX_QUEUE) {
      this.queue.shift();
    }
  }

  public clear() {
    this.queue = [];
    this.renderTime = null;
    this.lastArrivalTime = null;
    this.jitterMs = 0;
    this.targetDelayTicks = MIN_TARGET_DELAY_TICKS;
  }

  public getTargetDelayTicks(): number {
    return this.targetDelayTicks;
  }

  public getTargetDelayMs(tickRate = 30): number {
    return this.targetDelayTicks * (1000 / tickRate);
  }

  public interpolate(
    dt: number,
    tickRate: number,
  ): {
    state: GameState;
    lastState: GameState;
    progress: number;
  } | null {
    if (this.queue.length === 0) return null;
    const tickMs = 1000 / tickRate;

    if (this.queue.length >= 2) {
      const targetDelay = this.targetDelayTicks * tickMs;
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

  private _sampleJitter(timestamp: number, tickMs: number): void {
    if (this.lastArrivalTime !== null) {
      const delta = timestamp - this.lastArrivalTime;
      if (delta > 0 && delta < MAX_JITTER_SAMPLE_MS) {
        const sample = Math.abs(delta - tickMs);
        this.jitterMs += (sample - this.jitterMs) * JITTER_EMA_ALPHA;
        this._updateTargetDelay(tickMs);
      }
    }
    this.lastArrivalTime = timestamp;
  }

  private _updateTargetDelay(tickMs: number): void {
    if (this.jitterMs > tickMs * HIGH_JITTER_FRACTION) {
      this.targetDelayTicks = MAX_TARGET_DELAY_TICKS;
    } else if (this.jitterMs < tickMs * LOW_JITTER_FRACTION) {
      this.targetDelayTicks = MIN_TARGET_DELAY_TICKS;
    }
  }

  private _performInterpolation(renderTime: number): {
    state: GameState;
    lastState: GameState;
    progress: number;
  } {
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
    const progress =
      denom > 0.001 ? Math.max(0.0, Math.min(1.0, (renderTime - timeA) / denom)) : 1.0;

    return { state: stateB, lastState: stateA, progress };
  }
}
