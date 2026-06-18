// ROLE: Точка входа для режима спектатора. Инициализирует 3D движок с камерой свободного полёта.
import { SceneManager } from "../renderer/SceneManager";
import { NetworkManager } from "./NetworkManager";
import { SpectatorCamera } from "./SpectatorCamera";
import { RenderOrchestrator } from "./RenderOrchestrator";
import Stats from "stats.js";

export class SpectatorApp {
  private sceneManager: SceneManager;
  public networkManager: NetworkManager;
  private spectatorCamera: SpectatorCamera;
  private renderOrchestrator: RenderOrchestrator;
  private stats: Stats | null = null;
  private animFrameId = 0;
  private lastTime = performance.now();
  private latestFrame: any = null;
  private debugOverlay: HTMLDivElement;

  constructor(container: HTMLDivElement) {
    this.sceneManager = new SceneManager(container);
    this.networkManager = new NetworkManager();
    this.spectatorCamera = new SpectatorCamera(container);
    this.renderOrchestrator = new RenderOrchestrator(this.sceneManager);

    if (localStorage.getItem("snake-show-fps") === "true") {
      this.setStatsEnabled(true);
    }

    this.debugOverlay = document.createElement("div");
    this.debugOverlay.style.position = "absolute";
    this.debugOverlay.style.left = "10px";
    this.debugOverlay.style.top = "70px";
    this.debugOverlay.style.color = "white";
    this.debugOverlay.style.fontFamily = "monospace";
    this.debugOverlay.style.background = "rgba(0,0,0,0.7)";
    this.debugOverlay.style.padding = "10px";
    this.debugOverlay.style.borderRadius = "5px";
    this.debugOverlay.style.zIndex = "1000";
    this.debugOverlay.style.pointerEvents = "none";
    container.appendChild(this.debugOverlay);

    this.networkManager.setCallbacks({
      onFrameData: (msg) => {
        this.latestFrame = msg;
        this.updateDebugOverlay(msg);

        const players = msg.gameState?.players || {};
        const sorted = Object.values(players)
          .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
          .slice(0, 10)
          .map((p: any) => ({
            id: p.id,
            nickname: p.nickname,
            score: Math.floor(p.score || 0),
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            isMe: false
          }));
        window.dispatchEvent(new CustomEvent("game-leaderboard", { detail: sorted }));
      }
    });

    // Start with "spectator" role
    this.networkManager.connect("Spectator", "spectator", "spectator");
    this.tick();
  }

  private updateDebugOverlay(msg: any): void {
    const players = msg.gameState?.players || {};
    const food = msg.gameState?.food || {};
    
    let html = `<b>SPECTATOR MODE</b><br/>`;
    html += `Players: ${Object.keys(players).length}<br/>`;
    html += `Food: ${Object.keys(food).length}<br/><hr/>`;
    
    // Sort players by length descending
    const sorted = Object.values(players).sort((a: any, b: any) => (b.body_len || 0) - (a.body_len || 0));
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const p: any = sorted[i];
      const len = p.body_len || 0;
      html += `#${i+1} ${p.nickname} (Len: ${len})<br/>`;
    }
    
    this.debugOverlay.innerHTML = html;
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
    this.networkManager.requestFrame(dt, "spectator_id", { turn: 0, accelerating: false, mode: "mouse" });

    this.spectatorCamera.update(this.sceneManager.getCamera());

    if (this.latestFrame) {
      this.renderOrchestrator.updateAndRender(dt, now, this.latestFrame, "spectator_id", false, true, null);
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
    this.debugOverlay.remove();
  }
}
