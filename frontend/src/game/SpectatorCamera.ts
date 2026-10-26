// ROLE: Камера для режима спектатора. Поддерживает панорамирование мышкой (перетаскивание) и зум колесиком.
import * as THREE from "three";
import { gridSize, WORLD_WIDTH, WORLD_HEIGHT } from "./Config";

export class SpectatorCamera {
  private currentX = (WORLD_WIDTH / 2) * gridSize;
  private currentY = -(WORLD_HEIGHT / 2) * gridSize;
  private currentZoom = Math.max(WORLD_WIDTH, WORLD_HEIGHT) * gridSize;

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private container: HTMLDivElement;
  private mapWidth = WORLD_WIDTH;
  private mapHeight = WORLD_HEIGHT;
  private hasMapSize = false;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.container.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
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
    this.currentX = Math.max(0, Math.min(this.currentX, mapW));
    this.currentY = Math.max(-mapH, Math.min(this.currentY, 0));
    this.currentZoom = Math.min(this.currentZoom, Math.max(mapW, mapH));
  }

  public destroy(): void {
    this.container.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.container.removeEventListener("wheel", this.onWheel);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.isDragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    // Convert screen pixels to world coordinates approximately
    const panSpeed = this.currentZoom * 0.002;
    this.currentX -= dx * panSpeed;
    this.currentY += dy * panSpeed;

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    const zoomSpeed = 0.1;
    if (e.deltaY > 0) {
      this.currentZoom *= (1 + zoomSpeed);
    } else {
      this.currentZoom *= (1 - zoomSpeed);
    }
    this.currentZoom = Math.max(50.0, Math.min(this.currentZoom, Math.max(this.mapWidth, this.mapHeight) * gridSize));
  };

  public update(camera: THREE.PerspectiveCamera): void {
    const mapW_geo = this.mapWidth * gridSize;
    const mapH_geo = this.mapHeight * gridSize;

    // Clamp camera within map bounds
    this.currentX = Math.max(0, Math.min(this.currentX, mapW_geo));
    this.currentY = Math.max(-mapH_geo, Math.min(this.currentY, 0));

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
