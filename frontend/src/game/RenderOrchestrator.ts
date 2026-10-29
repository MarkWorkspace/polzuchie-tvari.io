// ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены. Не содержит логики ввода или сети.

import * as THREE from "three";
import { BlackHoleRenderer } from "../renderer/BlackHoleRenderer";
import { DebugRenderer } from "../renderer/DebugRenderer";
import { FoodRenderer } from "../renderer/FoodRenderer";
import { GRASS_GROUND_Z, GrassRenderer } from "../renderer/GrassRenderer";
import { NicknameRenderer } from "../renderer/NicknameRenderer";
import { ParticleRenderer } from "../renderer/ParticleRenderer";
import { PortalRenderer } from "../renderer/PortalRenderer";
import { PropRenderer } from "../renderer/PropRenderer";
import { QUALITY_PRESETS } from "../renderer/RenderQuality";
import type { SceneManager } from "../renderer/SceneManager";
import { SnakeRenderer } from "../renderer/SnakeRenderer";
import { TombstoneRenderer } from "../renderer/TombstoneRenderer";
import type { GameCamera } from "./Camera";

export class RenderOrchestrator {
  private sceneManager: SceneManager;
  private snakeRenderer: SnakeRenderer;
  private nicknameRenderer: NicknameRenderer;
  private foodRenderer: FoodRenderer;
  private portalRenderer: PortalRenderer;
  private blackHoleRenderer: BlackHoleRenderer;
  private particleRenderer: ParticleRenderer;
  private debugRenderer: DebugRenderer;
  private tombstoneRenderer: TombstoneRenderer;
  private grassRenderer: GrassRenderer;
  private propRenderer: PropRenderer;
  private postRenderCallbacks: ((frame: any, myId: string) => void)[] = [];
  private readonly grassForward = new THREE.Vector3();
  private readonly grassView = { x: 0, y: 0, halfExtent: 0 };

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    const scene = this.sceneManager.getScene();

    this.snakeRenderer = new SnakeRenderer(scene);
    this.nicknameRenderer = new NicknameRenderer();
    this.foodRenderer = new FoodRenderer(scene);
    this.portalRenderer = new PortalRenderer(scene);
    this.blackHoleRenderer = new BlackHoleRenderer(scene);
    this.particleRenderer = new ParticleRenderer(scene);
    this.debugRenderer = new DebugRenderer(scene);
    this.tombstoneRenderer = new TombstoneRenderer(scene);
    this.grassRenderer = new GrassRenderer(scene);
    this.propRenderer = new PropRenderer(scene);
  }

  public onPostRender(callback: (frame: any, myId: string) => void): void {
    this.postRenderCallbacks.push(callback);
  }

  public updateAndRender(
    dt: number,
    now: number,
    frame: any,
    myId: string,
    isAccelerating: boolean,
    debugMode: boolean,
    gameCamera?: GameCamera | null,
  ): void {
    const camera = this.sceneManager.getCamera();
    const width = this.sceneManager.getWidth();
    const height = this.sceneManager.getHeight();
    frame.myId = myId; // Attach myId for overlay queries

    if (gameCamera) {
      gameCamera.update(camera, frame, dt, myId, isAccelerating);
    }
    this.resolveGrassView(camera, frame);
    const grassBudget = QUALITY_PRESETS[this.sceneManager.getQuality()].grass;
    this.grassRenderer.update(
      frame,
      grassBudget,
      now,
      this.grassView.x,
      this.grassView.y,
      this.grassView.halfExtent,
    );
    this.propRenderer.update(
      frame,
      grassBudget,
      now,
      this.grassView.x,
      this.grassView.y,
      this.grassView.halfExtent,
    );
    this.foodRenderer.update(frame);
    this.portalRenderer.update(frame, now / 1000.0);
    this.blackHoleRenderer.update(frame, now / 1000.0);
    this.particleRenderer.update(frame);
    this.snakeRenderer.update(frame, camera, width, height);
    this.nicknameRenderer.update(frame, camera, width, height);
    this.debugRenderer.update(frame, debugMode);
    this.tombstoneRenderer.update(frame);

    this.sceneManager.render(frame);

    for (const cb of this.postRenderCallbacks) {
      cb(frame, myId);
    }
  }

  public destroy(): void {
    this.snakeRenderer.destroy();
    this.nicknameRenderer.destroy();
    this.foodRenderer.destroy();
    this.portalRenderer.destroy();
    this.blackHoleRenderer.destroy();
    this.particleRenderer.destroy();
    this.debugRenderer.destroy();
    this.tombstoneRenderer.destroy();
    this.grassRenderer.destroy();
    this.propRenderer.destroy();
  }

  /**
   * Grass follows the camera's actual ground target, which exists in both player
   * and spectator modes (spectator frames do not carry usable camX/camY).
   * Intersects the camera forward ray with the grass plane and returns the
   * half-extent of the visible ground for cull-radius scaling.
   */
  private resolveGrassView(camera: THREE.PerspectiveCamera, frame: any): void {
    let x = Number.isFinite(frame?.camX) ? frame.camX : 0;
    let y = Number.isFinite(frame?.camY) ? frame.camY : 0;
    let halfExtent = 0;

    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    if (Number.isFinite(camX) && Number.isFinite(camY) && Number.isFinite(camZ)) {
      const forward = camera.getWorldDirection(this.grassForward);
      const t = Math.abs(forward.z) >= 1e-4 ? (GRASS_GROUND_Z - camZ) / forward.z : Number.NaN;

      if (Number.isFinite(t) && t > 0) {
        x = camX + forward.x * t;
        y = camY + forward.y * t;
        halfExtent = t * Math.tan((camera.fov * Math.PI) / 360);
      } else {
        // Camera parallel to the plane or looking away: stay above the camera.
        x = camX;
        y = camY;
      }
    }

    this.grassView.x = x;
    this.grassView.y = y;
    this.grassView.halfExtent = halfExtent;
  }
}
