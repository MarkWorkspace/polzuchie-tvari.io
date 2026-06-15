// ROLE: Score, ping, статус соединения. Не игровая логика.
import { t } from "../lib/i18n";

export class HUD {
  private container: HTMLDivElement;
  private hudElement: HTMLDivElement | null = null;

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
  }

  private render(): void {
    this.hudElement = document.createElement("div");
    this.hudElement.className = "score-panel glass-panel hud-interactive";
    this.hudElement.innerHTML = `
      <span class="score-title">Score</span>
      <span class="score-value" id="hud-score">0</span>
      <div id="hud-score-feed" class="score-feed"></div>
      <div id="hud-ping" class="hud-ping">offline</div>
      <div id="hud-guide" class="hud-guide">${t("status.connecting")}</div>
    `;
    this.container.appendChild(this.hudElement);
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
    pingEl.textContent = `Ping: ${Math.round(latency)} ms`;
    if (latency <= 75) pingEl.style.color = "#4ade80";
    else if (latency <= 150) pingEl.style.color = "#fbbf24";
    else pingEl.style.color = "#f87171";
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
