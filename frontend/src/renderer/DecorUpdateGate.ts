// ROLE: Shared rebuild throttle for decorative fields: rebuild only when the camera moved,
// the budget/radius changed, or the interval elapsed. No rendering, no placement.

/** Minimum time between two decor rebuilds, even while the camera glides. */
export const DECOR_REBUILD_INTERVAL_MS = 250;

/** Camera movement that forces a rebuild, in squared world units (4 world units). */
export const DECOR_CAMERA_MOVE_SQ = 16;

/** Absolute cull-radius change that forces a rebuild, world units. */
export const DECOR_RADIUS_CHANGE_MIN = 24;

/** Relative cull-radius change that forces a rebuild. */
export const DECOR_RADIUS_CHANGE_RATIO = 0.05;

export interface DecorViewState {
  nowMs: number;
  camX: number;
  camY: number;
  mapX: number;
  mapY: number;
  budget: number;
  cullRadius: number;
  viewExtent: number;
}

const CAMERA_MOVE_SQ = DECOR_CAMERA_MOVE_SQ;

export class DecorUpdateGate {
  private lastBuildAt = Number.NEGATIVE_INFINITY;
  private camX = Number.NaN;
  private camY = Number.NaN;
  private mapX = -1;
  private mapY = -1;
  private budget = -1;
  private radius = Number.NaN;
  private viewExtent = Number.NaN;

  public shouldRebuild(state: DecorViewState): boolean {
    if (state.mapX !== this.mapX || state.mapY !== this.mapY) return true;
    if (state.budget !== this.budget) return true;

    const rebuildDue = state.nowMs - this.lastBuildAt >= DECOR_REBUILD_INTERVAL_MS;
    if (!rebuildDue) return false;

    const moved = this.hasCameraMoved(state.camX, state.camY);
    const radiusChanged =
      !Number.isFinite(this.radius) ||
      Math.abs(state.cullRadius - this.radius) >
        Math.max(DECOR_RADIUS_CHANGE_MIN, state.cullRadius * DECOR_RADIUS_CHANGE_RATIO);
    const viewChanged =
      !Number.isFinite(this.viewExtent) ||
      Math.abs(state.viewExtent - this.viewExtent) >
        Math.max(DECOR_RADIUS_CHANGE_MIN, state.viewExtent * DECOR_RADIUS_CHANGE_RATIO);

    return moved || radiusChanged || viewChanged;
  }

  public markBuilt(state: DecorViewState): void {
    this.lastBuildAt = state.nowMs;
    this.camX = state.camX;
    this.camY = state.camY;
    this.mapX = state.mapX;
    this.mapY = state.mapY;
    this.budget = state.budget;
    this.radius = state.cullRadius;
    this.viewExtent = state.viewExtent;
  }

  /** Forces the next visible frame to rebuild after the field was hidden. */
  public invalidate(): void {
    this.budget = -1;
  }

  private hasCameraMoved(camX: number, camY: number): boolean {
    if (!Number.isFinite(this.camX) || !Number.isFinite(this.camY)) return true;
    const dx = camX - this.camX;
    const dy = camY - this.camY;
    return dx * dx + dy * dy >= CAMERA_MOVE_SQ;
  }
}
