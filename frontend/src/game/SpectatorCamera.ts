// ROLE: Камера спектатора: свободное панорамирование/зум и плавное слежение за игроком.
import type * as THREE from "three";
import { gridSize, WORLD_HEIGHT, WORLD_WIDTH } from "./Config";
import { shortestToroidalDelta, wrapWithin } from "./spectatorCameraMath";

const FOLLOW_ZOOM = 30 * gridSize;
const FOLLOW_SMOOTHING = 8;
const MIN_ZOOM = 50;
const WHEEL_ZOOM_STEP = 0.1;

interface PointerPosition {
  x: number;
  y: number;
}

export class SpectatorCamera {
  private currentX = (WORLD_WIDTH / 2) * gridSize;
  private currentY = -(WORLD_HEIGHT / 2) * gridSize;
  private currentZoom = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * gridSize;

  private isDragging = false;
  private dragPointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private readonly activePointers = new Map<number, PointerPosition>();
  private pinchDistance: number | null = null;
  private container: HTMLDivElement;
  private mapWidth = WORLD_WIDTH;
  private mapHeight = WORLD_HEIGHT;
  private hasMapSize = false;

  private followX: number | null = null;
  private followY = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    // Pointer events cover mouse, touch and pen with one code path.
    this.container.addEventListener("pointerdown", this.onPointerDown);
    // Listen on window so a drag keeps panning when the pointer leaves the canvas.
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.container.addEventListener("wheel", this.onWheel);
  }

  public setMapSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width === this.mapWidth && height === this.mapHeight) return;
    this.mapWidth = Math.max(1, width);
    this.mapHeight = Math.max(1, height);
    const mapW = this.mapWidth * gridSize;
    const mapH = this.mapHeight * gridSize;
    if (!this.hasMapSize) {
      this.hasMapSize = true;
      this.currentX = mapW / 2;
      this.currentY = -mapH / 2;
      this.currentZoom = Math.max(mapW, mapH);
      return;
    }
    if (this.followX === null) this.clampToMap();
    this.currentZoom = Math.min(this.currentZoom, Math.max(mapW, mapH));
  }

  public getViewPosition(): { x: number; y: number } {
    return { x: this.currentX, y: this.currentY };
  }

  public follow(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (this.followX === null) {
      const maxZoom = Math.max(this.mapWidth, this.mapHeight) * gridSize;
      this.currentZoom = Math.min(this.currentZoom, FOLLOW_ZOOM, maxZoom);
    }
    this.followX = x;
    this.followY = y;
  }

  public showOverview(): void {
    this.followX = null;
    const mapW = this.mapWidth * gridSize;
    const mapH = this.mapHeight * gridSize;
    this.currentX = mapW / 2;
    this.currentY = -mapH / 2;
    this.currentZoom = Math.max(mapW, mapH);
  }

  public destroy(): void {
    this.container.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.container.removeEventListener("wheel", this.onWheel);
    this.activePointers.clear();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size >= 2) {
      this.isDragging = false;
      this.dragPointerId = null;
      this.pinchDistance = this.getPinchDistance();
      return;
    }

    if (this.followX !== null) return;
    this.isDragging = true;
    this.dragPointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    const pointer = this.activePointers.get(e.pointerId);
    if (!pointer) return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    if (this.activePointers.size >= 2) {
      const distance = this.getPinchDistance();
      if (distance !== null) {
        if (this.pinchDistance !== null && this.pinchDistance > 0 && distance > 0) {
          // Fingers apart (distance grows) zoom the camera in: camera Z shrinks.
          this.applyZoom(this.pinchDistance / distance);
        }
        this.pinchDistance = distance;
      }
      if (e.cancelable) e.preventDefault();
      return;
    }

    if (!this.isDragging || e.pointerId !== this.dragPointerId) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;

    // Convert screen pixels to world coordinates approximately
    const panSpeed = this.currentZoom * 0.002;
    this.currentX -= dx * panSpeed;
    this.currentY += dy * panSpeed;

    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (e.cancelable) e.preventDefault();
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) this.pinchDistance = null;
    if (this.dragPointerId === e.pointerId) {
      this.isDragging = false;
      this.dragPointerId = null;
    }
  };

  private getPinchDistance(): number | null {
    const pointers = Array.from(this.activePointers.values());
    if (pointers.length < 2) return null;
    return Math.hypot(pointers[0].x - pointers[1].x, pointers[0].y - pointers[1].y);
  }

  private applyZoom(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const maxZoom = Math.max(this.mapWidth, this.mapHeight) * gridSize;
    this.currentZoom = Math.max(MIN_ZOOM, Math.min(this.currentZoom * factor, maxZoom));
  }

  private onWheel = (e: WheelEvent): void => {
    this.applyZoom(e.deltaY > 0 ? 1 + WHEEL_ZOOM_STEP : 1 - WHEEL_ZOOM_STEP);
  };

  private clampToMap(): void {
    const mapW = this.mapWidth * gridSize;
    const mapH = this.mapHeight * gridSize;
    this.currentX = Math.max(0, Math.min(this.currentX, mapW));
    this.currentY = Math.max(-mapH, Math.min(this.currentY, 0));
  }

  public update(camera: THREE.PerspectiveCamera, dt = 1 / 60): void {
    if (this.followX !== null) {
      const mapW = this.mapWidth * gridSize;
      const mapH = this.mapHeight * gridSize;
      const smoothing = 1 - Math.exp(-FOLLOW_SMOOTHING * Math.max(0, dt));
      this.currentX = wrapWithin(
        this.currentX + shortestToroidalDelta(this.currentX, this.followX, mapW) * smoothing,
        mapW,
      );
      this.currentY = wrapWithin(
        this.currentY + shortestToroidalDelta(this.currentY, this.followY, mapH) * smoothing,
        mapH,
        -mapH,
      );
    } else {
      this.clampToMap();
    }

    camera.position.set(this.currentX, this.currentY, this.currentZoom);
    camera.lookAt(this.currentX, this.currentY, 0);
    camera.up.set(0, 1, 0);

    // Make sure we see enough
    camera.fov = 60;
    camera.near = 1.0;
    camera.far = 10000.0;
    camera.updateProjectionMatrix();
  }
}
