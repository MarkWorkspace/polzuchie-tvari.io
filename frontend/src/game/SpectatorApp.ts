// ROLE: Точка входа для режима спектатора. Инициализирует 3D движок с камерой свободного полёта.
import { SceneManager } from "../renderer/SceneManager";
import { NetworkManager } from "./NetworkManager";
import { SpectatorCamera } from "./SpectatorCamera";
import { RenderOrchestrator } from "./RenderOrchestrator";
import Stats from "stats.js";
import * as THREE from "three";
import { gridSize } from "./Config";

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
  private globalDebugPanel: HTMLDivElement;
  private globalStatsDiv: HTMLDivElement;
  private snakeDebugPanel: HTMLDivElement;
  private debugSnakeSelect: HTMLSelectElement;
  private debugSnakeId: string | null = null;
  private displayedPing = 0;
  private lastPingUpdate = 0;

  private mouse = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private cursorWorldX = 0;
  private cursorWorldY = 0;

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
    this.debugOverlay.style.pointerEvents = "auto";
    this.debugOverlay.style.display = "flex";
    this.debugOverlay.style.flexDirection = "column";
    this.debugOverlay.style.gap = "10px";
    container.appendChild(this.debugOverlay);

    // Add toggle for "Show all in main copy"
    const label = document.createElement("label");
    label.style.cursor = "pointer";
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.style.fontSize = "12px";
    label.style.fontFamily = "sans-serif";
    label.style.opacity = "0.9";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.showAllInMainCopy;
    checkbox.onchange = (e) => {
      this.showAllInMainCopy = (e.target as HTMLInputElement).checked;
    };
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("Отображать всё в главной копии"));
    this.debugOverlay.appendChild(label);

    const statsDiv = document.createElement("div");
    this.debugOverlay.appendChild(statsDiv);

    // Global Debug Panel
    this.globalDebugPanel = document.createElement("div");
    this.globalDebugPanel.style.position = "absolute";
    this.globalDebugPanel.style.left = "10px";
    this.globalDebugPanel.style.top = "300px"; // Below the first panel
    this.globalDebugPanel.style.color = "white";
    this.globalDebugPanel.style.fontFamily = "monospace";
    this.globalDebugPanel.style.background = "rgba(0,0,0,0.7)";
    this.globalDebugPanel.style.padding = "10px";
    this.globalDebugPanel.style.borderRadius = "5px";
    this.globalDebugPanel.style.zIndex = "1000";
    this.globalDebugPanel.style.pointerEvents = "auto";
    this.globalDebugPanel.style.display = "flex";
    this.globalDebugPanel.style.flexDirection = "column";
    this.globalDebugPanel.style.gap = "5px";
    
    this.globalStatsDiv = document.createElement("div");
    this.globalDebugPanel.appendChild(this.globalStatsDiv);

    const selectLabel = document.createElement("label");
    selectLabel.innerText = "Debug Snake:";
    selectLabel.style.fontSize = "12px";
    selectLabel.style.fontFamily = "sans-serif";
    selectLabel.style.marginTop = "5px";
    this.globalDebugPanel.appendChild(selectLabel);

    this.debugSnakeSelect = document.createElement("select");
    this.debugSnakeSelect.style.background = "#222";
    this.debugSnakeSelect.style.color = "white";
    this.debugSnakeSelect.style.border = "1px solid #555";
    this.debugSnakeSelect.style.padding = "4px";
    this.debugSnakeSelect.onchange = (e) => {
      this.debugSnakeId = (e.target as HTMLSelectElement).value;
      if (this.debugSnakeId === "") this.debugSnakeId = null;
    };
    this.globalDebugPanel.appendChild(this.debugSnakeSelect);
    container.appendChild(this.globalDebugPanel);

    // Snake Debug Panel
    this.snakeDebugPanel = document.createElement("div");
    this.snakeDebugPanel.style.position = "absolute";
    this.snakeDebugPanel.style.right = "10px";
    this.snakeDebugPanel.style.bottom = "10px";
    this.snakeDebugPanel.style.color = "white";
    this.snakeDebugPanel.style.fontFamily = "monospace";
    this.snakeDebugPanel.style.background = "rgba(0,0,0,0.7)";
    this.snakeDebugPanel.style.padding = "10px";
    this.snakeDebugPanel.style.borderRadius = "5px";
    this.snakeDebugPanel.style.zIndex = "1000";
    this.snakeDebugPanel.style.pointerEvents = "none";
    this.snakeDebugPanel.style.minWidth = "200px";
    container.appendChild(this.snakeDebugPanel);

    container.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    this.networkManager.setCallbacks({
      onPing: (latency) => {
        const now = performance.now();
        if (now - this.lastPingUpdate > 1000) {
          this.displayedPing = Math.round(latency);
          this.lastPingUpdate = now;
        }
      },
      onFrameData: (msg) => {
        this.latestFrame = msg;
        this.updateDebugOverlay(msg, statsDiv);

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

  private showAllInMainCopy = false;

  private updateDebugOverlay(msg: any, statsDiv: HTMLDivElement): void {
    const players = msg.gameState?.players || {};
    const food = msg.gameState?.food || {};
    
    // 1. TOP LEFT PANEL
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
    statsDiv.innerHTML = html;

    // 2. BOTTOM LEFT PANEL (GLOBAL DEBUG)
    const portals = msg.gameState?.portals || [];
    const blackHoles = msg.gameState?.black_holes || [];
    const tickRate = msg.gameState?.server_simulation?.tick_rate || 30;

    let globalHtml = `<b>GLOBAL DEBUG</b><br/>`;
    globalHtml += `Cursor X: ${(this.cursorWorldX / gridSize).toFixed(1)}<br/>`;
    globalHtml += `Cursor Y: ${(-this.cursorWorldY / gridSize).toFixed(1)}<br/>`;
    globalHtml += `Ping: ${this.displayedPing} ms<br/>`;
    globalHtml += `Tick Rate: ${tickRate} TPS<br/>`;
    globalHtml += `Portals: ${portals.length}<br/>`;
    globalHtml += `Black Holes: ${blackHoles.length}<br/>`;
    this.globalStatsDiv.innerHTML = globalHtml;

    // Update the select options
    const currentOptions = Array.from(this.debugSnakeSelect.options).map(o => o.value);
    const newOptions = Object.keys(players);
    newOptions.unshift(""); // empty option

    // Only rebuild if the list of player IDs changed
    if (currentOptions.join(",") !== newOptions.join(",")) {
      this.debugSnakeSelect.innerHTML = `<option value="">-- None --</option>`;
      for (const id in players) {
        const p = players[id];
        const opt = document.createElement("option");
        opt.value = id;
        opt.innerText = `${p.nickname} (${id.substring(0,4)})`;
        this.debugSnakeSelect.appendChild(opt);
      }
      this.debugSnakeSelect.value = this.debugSnakeId || "";
    }

    // 3. BOTTOM RIGHT PANEL (SNAKE DEBUG)
    if (this.debugSnakeId && players[this.debugSnakeId]) {
      const p = players[this.debugSnakeId];
      let snakeHtml = `<b>SNAKE DEBUG</b><br/>`;
      snakeHtml += `ID: <span style="user-select:all">${p.id}</span><br/>`;
      snakeHtml += `Name: ${p.nickname}<br/>`;
      // In FrameComputer, body is replaced by head_x, head_y raw indices
      snakeHtml += `Position: X:${(p.head_x ?? 0).toFixed(1)} Y:${(p.head_y ?? 0).toFixed(1)}<br/>`;
      snakeHtml += `Score: ${p.score || 0}<br/>`;
      snakeHtml += `Length: ${p.body_len || 0}<br/>`;
      snakeHtml += `Kills: ${p.kills || 0} Deaths: ${p.deaths || 0}<br/>`;
      snakeHtml += `Angle: ${p.angle?.toFixed(2) || "0.00"}<br/>`;
      snakeHtml += `Accelerating: ${p.accelerating ? "YES" : "NO"}<br/>`;
      snakeHtml += `State: ${p.is_dead ? "DEAD" : "ALIVE"}<br/>`;
      if (p.teleport_state && p.teleport_state !== "none") {
        snakeHtml += `Teleport: ${p.teleport_state}<br/>`;
      }
      this.snakeDebugPanel.innerHTML = snakeHtml;
    } else {
      this.snakeDebugPanel.innerHTML = `<b>SNAKE DEBUG</b><br/><br/>Змейка не выбрана`;
    }
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
    this.networkManager.requestFrame(dt, "spectator_id", { turn: 0, accelerating: false, mode: "mouse" }, this.showAllInMainCopy);

    this.spectatorCamera.update(this.sceneManager.getCamera());

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.getCamera());
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      this.cursorWorldX = target.x;
      this.cursorWorldY = target.y;
    }

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
