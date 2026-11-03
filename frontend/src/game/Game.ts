// ROLE: Жизненный цикл приложения: init/update/destroy. Не содержит рендеринг.

import Stats from "stats.js";
import { t } from "../lib/i18n";
import type { RenderQuality } from "../renderer/RenderQuality";
import { SceneManager } from "../renderer/SceneManager";
import {
  type GameErrorOverlayHandle,
  mountGameErrorOverlay,
} from "../ui/react/mountGameErrorOverlay";
import { GameCamera } from "./Camera";
import type { ControlMode } from "./InputManager";
import { InputManager } from "./InputManager";
import { NetworkManager, type WorkerFailureReason } from "./NetworkManager";
import { RenderOrchestrator } from "./RenderOrchestrator";

export class Game {
  private readonly container: HTMLDivElement;
  private sceneManager: SceneManager;
  private inputManager: InputManager;
  public networkManager: NetworkManager;
  private gameCamera: GameCamera;
  private renderOrchestrator: RenderOrchestrator;

  private myId = "";
  private isConnected = false;
  private debugMode = false;
  private stats: Stats | null = null;

  private latestFrame: any = null;
  private lastTime = performance.now();
  private animFrameId = 0;
  private frameCounter = 0;
  private contextLost = false;
  private fatalError = false;
  private gameErrorOverlay: GameErrorOverlayHandle | null = null;
  private throttledTurn = 0.0;
  private lastTurnSendTime = 0;
  private lastAccelerating = false;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.sceneManager = new SceneManager(container);
    this.sceneManager.onContextLost(this.handleContextLost);
    this.sceneManager.onContextRestored(this.handleContextRestored);
    this.inputManager = new InputManager();
    this.networkManager = new NetworkManager();
    this.gameCamera = new GameCamera();
    this.renderOrchestrator = new RenderOrchestrator(this.sceneManager);

    // Setup performance monitoring via stats.js
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    this.stats.dom.style.position = "absolute";
    this.stats.dom.style.left = "190px";
    this.stats.dom.style.top = "20px";
    this.stats.dom.style.zIndex = "1000";

    // Prevent mouse/touch events from propagating to game canvas
    this.stats.dom.addEventListener("mousedown", (e) => e.stopPropagation());
    this.stats.dom.addEventListener("touchstart", (e) => e.stopPropagation());
    this.stats.dom.addEventListener("click", (e) => e.stopPropagation());

    const showFps = localStorage.getItem("snake-show-fps") === "true";
    this.stats.dom.style.display = showFps ? "block" : "none";
    container.appendChild(this.stats.dom);

    this.setupInputCallbacks();
    this.setupNetworkCallbacks();
    window.addEventListener("game-respawn", this.handleGameRespawn);
  }

  public start(nickname: string, skin: string): void {
    this.clearPlayerId();
    void this.networkManager.connect(nickname, skin);
    this.lastTime = performance.now();
    this.tick();
  }

  public destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("game-respawn", this.handleGameRespawn);
    if (typeof document !== "undefined") {
      delete document.body.dataset.gameFrames;
    }
    this.sendCleanRelease();
    this.clearPlayerId();
    this.networkManager.setCallbacks({});
    this.networkManager.close();
    this.inputManager.destroy();
    this.renderOrchestrator.destroy();
    this.gameErrorOverlay?.unmount();
    this.gameErrorOverlay = null;
    this.sceneManager.destroy();
    if (this.stats) {
      this.stats.dom.remove();
    }
  }

  public toggleDebug(): void {
    this.debugMode = !this.debugMode;
  }

  public setStatsEnabled(enabled: boolean): void {
    if (this.stats) {
      this.stats.dom.style.display = enabled ? "block" : "none";
    }
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }

  public getMyId(): string {
    return this.myId;
  }

  public getQuality(): RenderQuality {
    return this.sceneManager.getQuality();
  }

  public setQuality(quality: RenderQuality): void {
    this.sceneManager.setQuality(quality);
  }

  /**
   * Drop locally held input and send a full snapshot so the server cannot keep
   * stale boost/steer state across respawn or reconnect.
   */
  public resyncInput(): void {
    this.inputManager.resyncInput();
    this.throttledTurn = 0.0;
    this.lastAccelerating = false;
    this.lastTurnSendTime = 0;
    this.sendNetworkInput(true);
  }

  private handleGameRespawn = (): void => {
    this.resyncInput();
  };

  /**
   * GPU reset response: stop the frame loop and show the blocking overlay. The
   * overlay stays until SceneManager rebuilds its GPU resources and reports a
   * restore; if no restore arrives the player still has the reload action.
   */
  private handleContextLost = (): void => {
    if (this.contextLost) return;
    // A fatal worker failure owns the overlay; do not replace it with a WebGL message.
    if (this.fatalError) return;
    this.contextLost = true;
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = 0;

    this.showErrorOverlay(
      "WebGL context lost",
      "Восстанавливаем контекст… Если не восстановится, перезагрузите страницу.",
    );
  };

  /**
   * The renderer rebuilt its GPU resources in place, so resume the loop without
   * a reload. A fatal worker failure keeps priority: its overlay stays up.
   */
  private handleContextRestored = (): void => {
    // Nothing to resume if no loss was observed, or if the worker is already fatal.
    if (!this.contextLost || this.fatalError) return;

    this.contextLost = false;
    this.lastTime = performance.now();
    this.gameErrorOverlay?.unmount();
    this.gameErrorOverlay = null;

    // tick() schedules the next frame itself, so only restart a stopped loop.
    if (this.animFrameId === 0) this.tick();
  };

  /**
   * The worker is being replaced. Its `myId` belongs to the dead connection, so
   * the local identity is dropped until the recreated worker receives `YOUR_ID`.
   */
  private handleWorkerRestart = (): void => {
    this.isConnected = false;
    this.clearPlayerId();
    this.resyncInput();
    window.dispatchEvent(
      new CustomEvent("game-status", {
        detail: {
          status: "reconnecting",
          msgKey: "status.workerRestart",
          controlMode: this.inputManager.getControlMode(),
        },
      }),
    );
  };

  private handleFatalError = (reason: WorkerFailureReason): void => {
    if (this.fatalError) return;
    console.warn("[Game] Fatal worker failure", reason);
    this.fatalError = true;
    this.isConnected = false;
    this.clearPlayerId();
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = 0;

    this.showErrorOverlay(t("error.title"), t("error.workerCrashed"));
  };

  private showErrorOverlay(title: string, message: string): void {
    this.gameErrorOverlay?.unmount();
    this.gameErrorOverlay = mountGameErrorOverlay(this.container, { title, message });
    this.gameErrorOverlay.show();
  }

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      onControlModeChange: (mode: ControlMode) => {
        this.networkManager.send(`CONTROL_MODE:${mode}`);
        const status = this.isConnected ? "connected" : "connecting";
        window.dispatchEvent(
          new CustomEvent("game-status", { detail: { status, controlMode: mode } }),
        );
      },
      onInputUpdate: () => {},
    });
  }

  private sendCleanRelease(): void {
    if (this.isConnected) {
      this.networkManager.send("LEFT_UP");
      this.networkManager.send("RIGHT_UP");
      this.networkManager.send("SPACE_UP");
    }
  }

  private sendNetworkInput(forceSnapshot = false): void {
    if (!this.isConnected) return;

    const mode = this.inputManager.getControlMode();
    const isAccelerating = this.inputManager.isAccelerating();

    // 1. Edge-triggered Accelerating (Boost); a force snapshot always sends it.
    if (forceSnapshot || isAccelerating !== this.lastAccelerating) {
      this.networkManager.send(isAccelerating ? "SPACE_DOWN" : "SPACE_UP");
      this.lastAccelerating = isAccelerating;
    }

    // 2. Throttled Steering / Turning
    if (mode === "keyboard") {
      const turn = this.inputManager.getTurn();
      if (forceSnapshot || turn !== this.throttledTurn) {
        this.sendKeyboardTurn(turn);
        this.throttledTurn = turn;
      }
    } else {
      const turn = this.inputManager.getTurn();
      const now = performance.now();

      const timePassed = now - this.lastTurnSendTime > 40;
      const turnChanged = Math.abs(turn - this.throttledTurn) > 0.01;
      const isZeroSnap = turn === 0.0 && this.throttledTurn !== 0.0;

      if (forceSnapshot || isZeroSnap || (turnChanged && timePassed)) {
        this.networkManager.send(`TURN:${turn.toFixed(3)}`);
        this.throttledTurn = turn;
        this.lastTurnSendTime = now;
      }
    }
  }

  private sendKeyboardTurn(turn: number): void {
    if (turn === -1.0) {
      this.networkManager.send("LEFT_DOWN");
    } else if (turn === 1.0) {
      this.networkManager.send("RIGHT_DOWN");
    } else {
      this.networkManager.send("LEFT_UP");
      this.networkManager.send("RIGHT_UP");
    }
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.setCallbacks({
      onStatusChange: (status, msg, msgKey, msgParams) => {
        this.isConnected = status === "connected";
        const controlMode = this.inputManager.getControlMode();
        window.dispatchEvent(
          new CustomEvent("game-status", {
            detail: { status, msg, msgKey, msgParams, controlMode },
          }),
        );
        if (status === "connected") this.resyncInput();
      },
      onPing: (latency) => {
        window.dispatchEvent(new CustomEvent("game-ping", { detail: latency }));
      },
      onYourId: (id) => {
        this.myId = id;
        if (typeof document !== "undefined") {
          document.body.dataset.playerId = id;
        }
        // A new/restored identity starts with a clean input snapshot.
        this.resyncInput();
      },
      onFrameData: (msg) => {
        this.latestFrame = msg;
        const sensitivity = msg.gameState?.server_visual?.mouse_sensitivity;
        if (typeof sensitivity === "number") {
          this.inputManager.setMouseSensitivity(sensitivity);
        }
        if (msg.leaderboard) {
          window.dispatchEvent(new CustomEvent("game-leaderboard", { detail: msg.leaderboard }));
        }
        if (msg.kill_events) {
          window.dispatchEvent(
            new CustomEvent("game-killfeed", {
              detail: {
                events: msg.kill_events,
                players: msg.gameState?.players || {},
              },
            }),
          );
        }
      },
      onDisconnect: () => {
        this.isConnected = false;
        this.clearPlayerId();
        window.dispatchEvent(new CustomEvent("game-disconnect"));
      },
      onWorkerRestart: this.handleWorkerRestart,
      onFatalError: this.handleFatalError,
    });
  }

  /** Observable identity for E2E/debugging; cleared whenever the session ends. */
  private clearPlayerId(): void {
    this.myId = "";
    if (typeof document !== "undefined") {
      delete document.body.dataset.playerId;
    }
  }

  /**
   * E2E/debug observability, like `dataset.playerId`: a frame number that proves
   * the loop is advancing. Written on the first frame and then every 15 frames,
   * so it stays off the per-frame DOM path.
   */
  private publishFrameCounter(): void {
    if (typeof document !== "undefined") {
      document.body.dataset.gameFrames = String(this.frameCounter);
    }
  }

  private tick = (): void => {
    if (this.contextLost || this.fatalError) return;
    this.animFrameId = requestAnimationFrame(this.tick);

    this.frameCounter += 1;
    if (this.frameCounter === 1 || this.frameCounter % 15 === 0) {
      this.publishFrameCounter();
    }

    if (this.stats) {
      this.stats.begin();
    }

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;

    if (this.isConnected) {
      this.networkManager.requestFrame(dt, this.myId, {
        turn: this.inputManager.getTurn(),
        accelerating: this.inputManager.isAccelerating(),
        mode: this.inputManager.getControlMode(),
      });
      this.sendNetworkInput();
    }

    if (this.latestFrame) {
      this.renderOrchestrator.updateAndRender(
        dt,
        now,
        this.latestFrame,
        this.myId,
        this.inputManager.isAccelerating(),
        this.debugMode,
        this.gameCamera,
      );
    }

    if (this.stats) {
      this.stats.end();
    }
  };
}
