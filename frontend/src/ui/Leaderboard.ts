// ROLE: Топ таблица.
import { t } from "../lib/i18n";

interface LeaderboardEntry {
  id: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
  nickname?: string;
}

export interface LeaderboardOptions {
  limit?: number;
  hideHeader?: boolean;
  noBackground?: boolean;
  alwaysOpen?: boolean;
}

export class Leaderboard {
  private container: HTMLDivElement;
  private panel: HTMLDivElement | null = null;
  private limit: number;
  private isOpen: boolean;
  private options: LeaderboardOptions;
  private currentData: LeaderboardEntry[] = [];

  constructor(container: HTMLDivElement, options: LeaderboardOptions = {}) {
    this.container = container;
    this.options = options;
    this.limit = options.limit || 10;
    
    if (options.alwaysOpen) {
      this.isOpen = true;
    } else {
      const isMobile = typeof window !== "undefined" && (
        window.matchMedia("(pointer: coarse)").matches || 
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      );
      this.isOpen = !isMobile;
    }

    this.render();
    this.bindEvents();
  }

  public destroy(): void {
    window.removeEventListener("game-leaderboard", this.handleLeaderboardEvent as EventListener);
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  private render(): void {
    this.panel = document.createElement("div");
    this.panel.className = "leaderboard-panel hud-interactive";
    if (!this.options.noBackground) {
      this.panel.classList.add("glass-panel");
    } else {
      this.panel.style.background = "transparent";
      this.panel.style.border = "none";
      this.panel.style.boxShadow = "none";
      this.panel.style.padding = "0";
    }
    
    if (!this.options.hideHeader) {
      const header = document.createElement("div");
      header.className = "leaderboard-header";
      if (!this.options.alwaysOpen) header.style.cursor = "pointer";
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.userSelect = "none";
      
      const titleSpan = document.createElement("span");
      titleSpan.innerHTML = `🏆 ${t("leaderboard.top")} ${this.limit}`;
      header.appendChild(titleSpan);
      
      if (!this.options.alwaysOpen) {
        const arrowSpan = document.createElement("span");
        arrowSpan.className = "leaderboard-arrow";
        arrowSpan.style.fontSize = "10px";
        arrowSpan.style.transition = "transform 0.2s ease";
        arrowSpan.style.display = "inline-block";
        arrowSpan.style.color = "var(--text-muted)";
        arrowSpan.textContent = "▲";
        arrowSpan.style.transform = this.isOpen ? "rotate(180deg)" : "rotate(0deg)";
        header.appendChild(arrowSpan);
        
        header.addEventListener("click", () => {
          this.isOpen = !this.isOpen;
          const listEl = this.panel?.querySelector("#leaderboard-list") as HTMLElement;
          if (listEl) listEl.style.display = this.isOpen ? "flex" : "none";
          arrowSpan.style.transform = this.isOpen ? "rotate(180deg)" : "rotate(0deg)";
        });

        header.addEventListener("mouseenter", () => header.style.color = "#60a5fa");
        header.addEventListener("mouseleave", () => header.style.color = "");
      }
      this.panel.appendChild(header);
    }
    
    const listEl = document.createElement("div");
    listEl.className = "leaderboard-list custom-scrollbar";
    listEl.id = "leaderboard-list";
    listEl.style.display = this.isOpen ? "flex" : "none";
    listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 10px 0; font-size: 13px;">${t("leaderboard.waiting")}</div>`;
    
    this.panel.appendChild(listEl);
    this.container.appendChild(this.panel);
  }

  private bindEvents(): void {
    window.addEventListener("game-leaderboard", this.handleLeaderboardEvent as EventListener);
  }

  private handleLeaderboardEvent = (e: CustomEvent<LeaderboardEntry[]>): void => {
    this.currentData = e.detail || [];
    const listEl = this.panel?.querySelector("#leaderboard-list");
    if (!listEl) return;

    if (this.currentData.length === 0) {
      listEl.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 10px 0; font-size: 13px;">${t("leaderboard.waiting")}</div>`;
      return;
    }

    listEl.innerHTML = "";
    this.currentData.slice(0, this.limit).forEach((player, index) => {
      const item = this.createLeaderboardItem(player, index + 1);
      listEl.appendChild(item);
    });
  };

  private createLeaderboardItem(player: LeaderboardEntry, rank: number): HTMLDivElement {
    const item = document.createElement("div");
    item.className = `leaderboard-item ${player.isMe ? "self" : ""}`;
    
    const displayName = player.nickname || player.id.substring(0, 8);
    const scoreSize = this.options.noBackground ? "12px" : "14px";
    
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span class="leaderboard-name" style="color: ${player.isMe ? "#4ade80" : "inherit"}; font-size: ${scoreSize};">
          <span class="leaderboard-rank">${rank}.</span> ${displayName}
        </span>
        <span class="leaderboard-score" style="color: ${player.isMe ? "#4ade80" : "inherit"}; font-size: ${scoreSize};">${player.score}</span>
      </div>
      <div style="font-size: 9px; color: var(--text-muted); display: flex; gap: 8px; margin-top: 2px;">
        <span title="${t("leaderboard.kills")}">⚔️ ${player.kills ?? 0}</span>
        <span title="${t("leaderboard.deaths")}">💀 ${player.deaths ?? 0}</span>
      </div>
    `;
    
    item.style.flexDirection = "column";
    item.style.alignItems = "flex-start";
    if (this.options.noBackground) {
      item.style.padding = "2px 0";
    }
    return item;
  }
}
