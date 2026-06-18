// ROLE: Оркестрация обновления и отрисовки трехмерных объектов сцены. Не содержит логики ввода или сети.
import { SceneManager } from "../renderer/SceneManager";
import { GameCamera } from "./Camera";
import { SnakeRenderer } from "../renderer/SnakeRenderer";
import { NicknameRenderer } from "../renderer/NicknameRenderer";
import { FoodRenderer } from "../renderer/FoodRenderer";
import { PortalRenderer } from "../renderer/PortalRenderer";
import { BlackHoleRenderer } from "../renderer/BlackHoleRenderer";
import { ParticleRenderer } from "../renderer/ParticleRenderer";
import { DebugRenderer } from "../renderer/DebugRenderer";
import { TombstoneRenderer } from "../renderer/TombstoneRenderer";

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
  private postRenderCallbacks: ((frame: any, myId: string) => void)[] = [];

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
    gameCamera?: GameCamera | null
  ): void {
    const camera = this.sceneManager.getCamera();
    const width = this.sceneManager.getWidth();
    const height = this.sceneManager.getHeight();
    frame.myId = myId; // Attach myId for overlay queries

    if (gameCamera) {
      gameCamera.update(camera, frame, dt, myId, isAccelerating);
    }
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
  }
}
