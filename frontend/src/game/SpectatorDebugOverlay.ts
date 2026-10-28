// ROLE: Admin-only spectator debug panels (world stats and snake inspector). No rendering or networking.
import { escapeHtml } from "../lib/escapeHtml";
import { gridSize } from "./Config";

export interface DebugCursor {
  x: number;
  y: number;
}

export class SpectatorDebugOverlay {
  private readonly topPanel: HTMLDivElement;
  private readonly statsDiv: HTMLDivElement;
  private readonly globalPanel: HTMLDivElement;
  private readonly globalStatsDiv: HTMLDivElement;
  private readonly snakePanel: HTMLDivElement;
  private readonly snakeSelect: HTMLSelectElement;
  private showAll = false;
  private selectedSnakeId: string | null = null;

  constructor(container: HTMLElement) {
    this.topPanel = document.createElement("div");
    this.topPanel.className = "spectator-debug-panel spectator-debug-panel--top";

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "spectator-debug-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.showAll;
    checkbox.addEventListener("change", () => {
      this.showAll = checkbox.checked;
    });
    toggleLabel.append(checkbox, document.createTextNode("Отображать всё в главной копии"));

    this.statsDiv = document.createElement("div");
    this.topPanel.append(toggleLabel, this.statsDiv);
    container.appendChild(this.topPanel);

    this.globalPanel = document.createElement("div");
    this.globalPanel.className = "spectator-debug-panel spectator-debug-panel--global";
    this.globalStatsDiv = document.createElement("div");

    const selectLabel = document.createElement("label");
    selectLabel.className = "spectator-debug-label";
    selectLabel.textContent = "Debug Snake:";

    this.snakeSelect = document.createElement("select");
    this.snakeSelect.className = "spectator-debug-select";
    this.snakeSelect.addEventListener("change", () => {
      this.selectedSnakeId = this.snakeSelect.value || null;
    });

    this.globalPanel.append(this.globalStatsDiv, selectLabel, this.snakeSelect);
    container.appendChild(this.globalPanel);

    this.snakePanel = document.createElement("div");
    this.snakePanel.className = "spectator-debug-panel spectator-debug-panel--snake";
    container.appendChild(this.snakePanel);
  }

  public get showAllInMainCopy(): boolean {
    return this.showAll;
  }

  public update(msg: any, cursor: DebugCursor, ping: number): void {
    const players = msg.gameState?.players || {};
    this.updateStats(players, msg.foodCount ?? 0);
    this.updateGlobalStats(msg, cursor, ping);
    this.updateSnakeSelect(players);
    this.updateSnakePanel(players);
  }

  public destroy(): void {
    this.topPanel.remove();
    this.globalPanel.remove();
    this.snakePanel.remove();
  }

  private updateStats(players: Record<string, any>, foodCount: number): void {
    let html = "<b>SPECTATOR MODE</b><br/>";
    html += `Players: ${Object.keys(players).length}<br/>`;
    html += `Food: ${foodCount}<br/><hr/>`;

    const sorted = Object.values(players).sort(
      (a: any, b: any) => (b.body_len || 0) - (a.body_len || 0),
    );
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      const player: any = sorted[i];
      html += `#${i + 1} ${escapeHtml(String(player.nickname ?? ""))} (Len: ${player.body_len || 0})<br/>`;
    }
    this.statsDiv.innerHTML = html;
  }

  private updateGlobalStats(msg: any, cursor: DebugCursor, ping: number): void {
    const portals = msg.gameState?.portals || [];
    const blackHoles = msg.gameState?.black_holes || [];
    const tickRate = msg.gameState?.server_simulation?.tick_rate || 30;

    let html = "<b>GLOBAL DEBUG</b><br/>";
    html += `Cursor X: ${(cursor.x / gridSize).toFixed(1)}<br/>`;
    html += `Cursor Y: ${(-cursor.y / gridSize).toFixed(1)}<br/>`;
    html += `Ping: ${ping} ms<br/>`;
    html += `Tick Rate: ${tickRate} TPS<br/>`;
    html += `Portals: ${portals.length}<br/>`;
    html += `Black Holes: ${blackHoles.length}<br/>`;
    this.globalStatsDiv.innerHTML = html;
  }

  private updateSnakeSelect(players: Record<string, any>): void {
    const currentOptions = Array.from(this.snakeSelect.options).map((option) => option.value);
    const nextOptions = ["", ...Object.keys(players)];

    if (currentOptions.join(",") === nextOptions.join(",")) return;

    this.snakeSelect.replaceChildren(new Option("-- None --", ""));
    for (const id in players) {
      const player = players[id];
      this.snakeSelect.appendChild(new Option(`${player.nickname} (${id.substring(0, 4)})`, id));
    }
    this.snakeSelect.value = this.selectedSnakeId || "";
  }

  private updateSnakePanel(players: Record<string, any>): void {
    const player = this.selectedSnakeId ? players[this.selectedSnakeId] : undefined;
    if (!player) {
      this.snakePanel.innerHTML = "<b>SNAKE DEBUG</b><br/><br/>Змейка не выбрана";
      return;
    }

    let html = "<b>SNAKE DEBUG</b><br/>";
    html += `ID: <span style="user-select:all">${escapeHtml(this.selectedSnakeId ?? "")}</span><br/>`;
    html += `Name: ${escapeHtml(String(player.nickname ?? ""))}<br/>`;
    html += `Position: X:${(player.head_x ?? 0).toFixed(1)} Y:${(player.head_y ?? 0).toFixed(1)}<br/>`;
    html += `Score: ${player.score || 0}<br/>`;
    html += `Length: ${player.body_len || 0}<br/>`;
    html += `Kills: ${player.kills || 0} Deaths: ${player.deaths || 0}<br/>`;
    html += `Angle: ${player.angle?.toFixed(2) || "0.00"}<br/>`;
    html += `Accelerating: ${player.accelerating ? "YES" : "NO"}<br/>`;
    html += `State: ${player.is_dead ? "DEAD" : "ALIVE"}<br/>`;
    if (player.teleport_state && player.teleport_state !== "none") {
      html += `Teleport: ${player.teleport_state}<br/>`;
    }
    this.snakePanel.innerHTML = html;
  }
}
