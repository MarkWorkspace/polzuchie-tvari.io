// ROLE: Жизненный цикл приложения: init/update/destroy. Не содержит рендеринг.
import { SceneManager } from "../renderer/SceneManager";
import { InputManager } from "./InputManager";
import type { ControlMode } from "./InputManager";
import { NetworkManager } from "./NetworkManager";
import { GameCamera } from "./Camera";
import { RenderOrchestrator } from "./RenderOrchestrator";
import Stats from "stats.js";

export class Game {
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
  private throttledTurn = 0.0;
  private lastTurnSendTime = 0;
  private lastAccelerating = false;

  constructor(container: HTMLDivElement) {
    this.sceneManager = new SceneManager(container);
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
  }

  public start(nickname: string, skin: string): void {
    this.networkManager.connect(nickname, skin);
    this.lastTime = performance.now();
    this.tick();
  }

  public destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    this.sendCleanRelease();
    this.networkManager.close();
    this.inputManager.destroy();
    this.renderOrchestrator.destroy();
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

  private setupInputCallbacks(): void {
    this.inputManager.setCallbacks({
      onControlModeChange: (mode: ControlMode) => {
        this.networkManager.send(`CONTROL_MODE:${mode}`);
        const status = this.isConnected ? "connected" : "connecting";
        window.dispatchEvent(new CustomEvent("game-status", { detail: { status, controlMode: mode } }));
      },
      onInputUpdate: () => {}
    });
  }

  private sendCleanRelease(): void {
    if (this.isConnected) {
      this.networkManager.send("LEFT_UP");
      this.networkManager.send("RIGHT_UP");
      this.networkManager.send("SPACE_UP");
    }
  }

  private sendNetworkInput(): void {
    if (!this.isConnected) return;

    const mode = this.inputManager.getControlMode();
    const isAccelerating = this.inputManager.isAccelerating();

    // 1. Edge-triggered Accelerating (Boost)
    if (isAccelerating !== this.lastAccelerating) {
      this.networkManager.send(isAccelerating ? "SPACE_DOWN" : "SPACE_UP");
      this.lastAccelerating = isAccelerating;
    }

    // 2. Throttled Steering / Turning
    if (mode === "keyboard") {
      const turn = this.inputManager.getTurn();
      if (turn !== this.throttledTurn) {
        if (turn === -1.0) this.networkManager.send("LEFT_DOWN");
        else if (turn === 1.0) this.networkManager.send("RIGHT_DOWN");
        else {
          if (this.throttledTurn === -1.0) this.networkManager.send("LEFT_UP");
          else if (this.throttledTurn === 1.0) this.networkManager.send("RIGHT_UP");
          else {
            this.networkManager.send("LEFT_UP");
            this.networkManager.send("RIGHT_UP");
          }
        }
        this.throttledTurn = turn;
      }
    } else {
      const turn = this.inputManager.getTurn();
      const now = performance.now();

      const timePassed = now - this.lastTurnSendTime > 40;
      const turnChanged = Math.abs(turn - this.throttledTurn) > 0.01;
      const isZeroSnap = turn === 0.0 && this.throttledTurn !== 0.0;

      if (isZeroSnap || (turnChanged && timePassed)) {
        this.networkManager.send(`TURN:${turn.toFixed(3)}`);
        this.throttledTurn = turn;
        this.lastTurnSendTime = now;
      }
    }
  }

  private setupNetworkCallbacks(): void {
    this.networkManager.setCallbacks({
      onStatusChange: (status, msg, msgKey, msgParams) => {
        this.isConnected = status === "connected";
        const controlMode = this.inputManager.getControlMode();
        window.dispatchEvent(new CustomEvent("game-status", { detail: { status, msg, msgKey, msgParams, controlMode } }));
      },
      onPing: (latency) => {
        window.dispatchEvent(new CustomEvent("game-ping", { detail: latency }));
      },
      onYourId: (id) => {
        this.myId = id;
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
          window.dispatchEvent(new CustomEvent("game-killfeed", {
            detail: {
              events: msg.kill_events,
              players: msg.gameState?.players || {}
            }
          }));
        }
      },
      onDisconnect: () => {
        this.isConnected = false;
        window.dispatchEvent(new CustomEvent("game-disconnect"));
      }
    });
  }

  private tick = (): void => {
    this.animFrameId = requestAnimationFrame(this.tick);

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
        mode: this.inputManager.getControlMode()
      });
      this.sendNetworkInput();
    }

    if (this.latestFrame) {
      this.renderOrchestrator.updateAndRender(
        dt, now, this.latestFrame, this.myId,
        this.inputManager.isAccelerating(), this.debugMode, this.gameCamera
      );
    }

    if (this.stats) {
      this.stats.end();
    }
  };
}
