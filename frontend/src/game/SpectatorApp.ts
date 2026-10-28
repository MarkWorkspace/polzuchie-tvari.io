// ROLE: Ядро спектатора: камера, сеть и рендер; HUD/debug UI подключаются снаружи.

import Stats from "stats.js";
import * as THREE from "three";
import type { RenderQuality } from "../renderer/RenderQuality";
import { SceneManager } from "../renderer/SceneManager";
import { NetworkManager } from "./NetworkManager";
import { RenderOrchestrator } from "./RenderOrchestrator";
import { SpectatorCamera } from "./SpectatorCamera";
import { SpectatorDebugOverlay } from "./SpectatorDebugOverlay";

export class SpectatorApp {
  private sceneManager: SceneManager;
  public networkManager: NetworkManager;
  private spectatorCamera: SpectatorCamera;
  private renderOrchestrator: RenderOrchestrator;
  private stats: Stats | null = null;
  private animFrameId = 0;
  private lastTime = performance.now();
  private latestFrame: any = null;
  private readonly debug: boolean;
  private readonly debugOverlay: SpectatorDebugOverlay | null;
  private displayedPing = 0;
  private lastPingUpdate = 0;

  private mouse = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private cursorWorldX = 0;
  private cursorWorldY = 0;

  constructor(container: HTMLDivElement, options: { debug: boolean }) {
    this.debug = options.debug;
    this.sceneManager = new SceneManager(container);
    this.networkManager = new NetworkManager();
    this.spectatorCamera = new SpectatorCamera(container);
    this.renderOrchestrator = new RenderOrchestrator(this.sceneManager);
    this.debugOverlay = options.debug ? new SpectatorDebugOverlay(container) : null;

    if (localStorage.getItem("snake-show-fps") === "true") {
      this.setStatsEnabled(true);
    }

    if (this.debugOverlay) {
      container.addEventListener("mousemove", (e) => {
        const rect = container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      });
    }

    this.networkManager.setCallbacks({
      onStatusChange: (status, msg, msgKey, msgParams) => {
        window.dispatchEvent(
          new CustomEvent("game-status", {
            detail: { status, msg, msgKey, msgParams, controlMode: "mouse" },
          }),
        );
      },
      onPing: (latency) => {
        const now = performance.now();
        if (now - this.lastPingUpdate > 1000) {
          this.displayedPing = Math.round(latency);
          this.lastPingUpdate = now;
        }
      },
      onFrameData: (msg) => {
        this.latestFrame = msg;
        this.debugOverlay?.update(
          msg,
          { x: this.cursorWorldX, y: this.cursorWorldY },
          this.displayedPing,
        );

        if (msg.leaderboard) {
          window.dispatchEvent(new CustomEvent("game-leaderboard", { detail: msg.leaderboard }));
        }
      },
    });

    // Start with "spectator" role
    this.networkManager.connect("Spectator", "spectator", "spectator");

    this.tick();
  }

  public getQuality(): RenderQuality {
    return this.sceneManager.getQuality();
  }

  public setQuality(quality: RenderQuality): void {
    this.sceneManager.setQuality(quality);
  }

  public setStatsEnabled(enabled: boolean): void {
    if (enabled && !this.stats) {
      this.stats = new Stats();
      this.stats.showPanel(0);
      this.stats.dom.style.position = "absolute";
      this.stats.dom.style.left = "10px";
      this.stats.dom.style.top = "10px";
      this.stats.dom.style.zIndex = "1000";
      this.sceneManager.getRenderer().domElement.parentElement?.appendChild(this.stats.dom);
    } else if (!enabled && this.stats) {
      this.stats.dom.remove();
      this.stats = null;
    }
  }

  private tick = (): void => {
    this.animFrameId = requestAnimationFrame(this.tick);
    this.stats?.begin();

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000.0;
    this.lastTime = now;

    // Send dummy requests to get frames
    this.networkManager.requestFrame(
      dt,
      "spectator_id",
      { turn: 0, accelerating: false, mode: "mouse" },
      this.debugOverlay ? this.debugOverlay.showAllInMainCopy : true,
    );

    const serverWorld = this.latestFrame?.gameState?.server_world;
    if (serverWorld) {
      this.spectatorCamera.setMapSize(serverWorld.width, serverWorld.height);
    }
    this.spectatorCamera.update(this.sceneManager.getCamera());

    if (this.debugOverlay) {
      this.raycaster.setFromCamera(this.mouse, this.sceneManager.getCamera());
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const target = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, target)) {
        this.cursorWorldX = target.x;
        this.cursorWorldY = target.y;
      }
    }

    if (this.latestFrame) {
      this.renderOrchestrator.updateAndRender(
        dt,
        now,
        this.latestFrame,
        "spectator_id",
        false,
        this.debug,
        null,
      );
    } else {
      this.sceneManager.render(null);
    }

    this.stats?.end();
  };

  public destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.networkManager.close();
    this.spectatorCamera.destroy();
    this.renderOrchestrator.destroy();
    this.sceneManager.destroy();
    if (this.stats) this.stats.dom.remove();
    this.debugOverlay?.destroy();
  }
}
