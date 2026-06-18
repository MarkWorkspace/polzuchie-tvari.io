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

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.container.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    this.container.addEventListener("wheel", this.onWheel);
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
    this.currentZoom = Math.max(50.0, Math.min(this.currentZoom, Math.max(WORLD_WIDTH, WORLD_HEIGHT) * gridSize));
  };

  public update(camera: THREE.PerspectiveCamera): void {
    const mapW_geo = WORLD_WIDTH * gridSize;
    const mapH_geo = WORLD_HEIGHT * gridSize;

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
