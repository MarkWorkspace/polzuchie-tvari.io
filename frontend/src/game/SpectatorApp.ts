// ROLE: Ядро спектатора: камера, сеть и рендер; HUD/debug UI подключаются снаружи.

import Stats from "stats.js";
import * as THREE from "three";
import {
  GLOBE_SPHERE,
  type GlobeParams,
  globeOverscan,
  globeSampleUv,
} from "../renderer/GlobeLens";
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
  private followedPlayerId: string | null = null;
  private displayedPing = 0;
  private lastPingUpdate = 0;

  private mouse = new THREE.Vector2();
  private warpedMouse = new THREE.Vector2();
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

    window.addEventListener("spectator-follow", this.handleFollowRequest);

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
    void this.networkManager.connect("Spectator", "spectator", "spectator");

    this.tick();
  }

  private handleFollowRequest = (event: Event): void => {
    if (this.debug) return;
    const playerId = (event as CustomEvent<string | null>).detail;
    this.followedPlayerId = playerId || null;
    if (!this.followedPlayerId) this.spectatorCamera.showOverview();
  };

  private stopFollowing(): void {
    if (!this.followedPlayerId) return;
    this.followedPlayerId = null;
    this.spectatorCamera.showOverview();
    window.dispatchEvent(new CustomEvent("spectator-follow-ended"));
  }

  private updateFollowTarget(): void {
    if (!this.followedPlayerId || !this.latestFrame) return;

    const activePlayers = this.latestFrame.activePlayers as
      | Array<{ id: string; hx: number; hy: number }>
      | undefined;
    const target = activePlayers?.find((player) => player.id === this.followedPlayerId);
    if (target && Number.isFinite(target.hx) && Number.isFinite(target.hy)) {
      this.spectatorCamera.follow(target.hx, target.hy);
      return;
    }

    // The followed snake died or disconnected; return to the free camera.
    this.stopFollowing();
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
      this.debugOverlay ? this.debugOverlay.showAllInMainCopy : false,
      this.spectatorCamera.getViewPosition(),
    );

    const serverWorld = this.latestFrame?.gameState?.server_world;
    if (serverWorld) {
      this.spectatorCamera.setMapSize(serverWorld.width, serverWorld.height);
    }
    this.updateFollowTarget();
    this.spectatorCamera.update(this.sceneManager.getCamera(), dt);

    if (this.debugOverlay) {
      // The composer warps the image after rendering, so convert the raw mouse
      // NDC back through the inverse globe warp before raycasting. Mouse NDC y
      // already matches the shader's uv orientation here; no flip needed.
      const aspect = this.sceneManager.getWidth() / Math.max(1, this.sceneManager.getHeight());
      const globe: GlobeParams = {
        aspect,
        sphere: GLOBE_SPHERE,
        overscan: globeOverscan(GLOBE_SPHERE),
      };
      const sourceUv = globeSampleUv(this.mouse.x * 0.5 + 0.5, this.mouse.y * 0.5 + 0.5, globe);
      this.warpedMouse.set(sourceUv.x * 2 - 1, sourceUv.y * 2 - 1);
      this.raycaster.setFromCamera(this.warpedMouse, this.sceneManager.getCamera());
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
    window.removeEventListener("spectator-follow", this.handleFollowRequest);
    this.networkManager.close();
    this.spectatorCamera.destroy();
    this.renderOrchestrator.destroy();
    this.sceneManager.destroy();
    if (this.stats) this.stats.dom.remove();
    this.debugOverlay?.destroy();
  }
}
