// ROLE: Score, ping, статус соединения. Не игровая логика.
import { t } from "../lib/i18n";

export class HUD {
  private container: HTMLDivElement;
  private hudElement: HTMLDivElement | null = null;
  private feedElement: HTMLDivElement | null = null;
  private pingElement: HTMLDivElement | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.render();
    this.bindEvents();
  }

  public destroy(): void {
    window.removeEventListener("game-status", this.handleStatusEvent as EventListener);
    window.removeEventListener("game-ping", this.handlePingEvent as EventListener);
    window.removeEventListener("game-score-update", this.handleScoreEvent as EventListener);
    if (this.hudElement) {
      this.hudElement.remove();
      this.hudElement = null;
    }
    if (this.feedElement) {
      this.feedElement.remove();
      this.feedElement = null;
    }
    if (this.pingElement) {
      this.pingElement.remove();
      this.pingElement = null;
    }
  }

  private render(): void {
    this.hudElement = document.createElement("div");
    this.hudElement.className = "score-panel glass-panel hud-interactive";
    this.hudElement.innerHTML = `
      <span class="score-title">Score</span>
      <span class="score-value" id="hud-score">0</span>
      <div id="hud-guide" class="hud-guide">${t("status.connecting")}</div>
    `;
    this.container.appendChild(this.hudElement);

    this.feedElement = document.createElement("div");
    this.feedElement.id = "hud-score-feed";
    this.feedElement.className = "score-feed";
    this.container.appendChild(this.feedElement);

    this.pingElement = document.createElement("div");
    this.pingElement.id = "hud-ping";
    this.pingElement.className = "hud-ping";
    this.pingElement.innerHTML = `Ping: <span style="color: #f87171;">offline</span>`;
    this.container.appendChild(this.pingElement);
  }

  private bindEvents(): void {
    window.addEventListener("game-status", this.handleStatusEvent as EventListener);
    window.addEventListener("game-ping", this.handlePingEvent as EventListener);
    window.addEventListener("game-score-update", this.handleScoreEvent as EventListener);
  }

  private handleStatusEvent = (e: CustomEvent): void => {
    const guideEl = document.getElementById("hud-guide");
    if (!guideEl) return;

    const { status, msg, msgKey, msgParams, controlMode } = e.detail;
    if (status === "connected") {
      const mode = controlMode || "keyboard";
      const guideKey = mode === "keyboard" ? "status.kbdGuide" : "status.mouseGuide";
      const guideText = t(guideKey);
      
      const lines = guideText
        .split("|")
        .map(line => `<div>${line.trim()}</div>`)
        .join("");

      guideEl.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-primary); text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">${t("help.controls")}:</div>
        ${lines}
      `;
      guideEl.style.color = "#4ade80";
    } else {
      let text = msg || (msgKey ? t(msgKey as any, msgParams) : t("status.connecting"));
      guideEl.textContent = text;
      guideEl.style.color = "#fbbf24";
    }
  };

  private handlePingEvent = (e: CustomEvent): void => {
    const pingEl = document.getElementById("hud-ping");
    if (!pingEl) return;

    const latency = e.detail;
    let color = "#4ade80";
    if (latency > 150) color = "#f87171";
    else if (latency > 75) color = "#fbbf24";

    pingEl.style.color = "var(--text-muted)";
    pingEl.innerHTML = `Ping: <span style="color: ${color};">${Math.round(latency)} ms</span>`;
  };

  private handleScoreEvent = (e: CustomEvent): void => {
    const scoreEl = document.getElementById("hud-score");
    if (scoreEl) {
      scoreEl.textContent = String(e.detail.score);
    }
    if (e.detail.delta !== 0) {
      this.spawnScoreFeed(e.detail.delta);
    }
  };

  private spawnScoreFeed(delta: number): void {
    const container = document.getElementById("hud-score-feed");
    if (!container) return;

    const div = document.createElement("div");
    div.className = `score-feed-item ${delta > 0 ? "positive" : "negative"}`;
    div.textContent = delta > 0 ? `+${delta}` : `${delta}`;

    if (container.children.length >= 3) {
      container.removeChild(container.firstChild!);
    }
    container.appendChild(div);

    setTimeout(() => {
      div.style.opacity = "0";
      div.style.transform = "translateY(-15px)";
    }, 1000);

    setTimeout(() => div.remove(), 1500);
  }
}
