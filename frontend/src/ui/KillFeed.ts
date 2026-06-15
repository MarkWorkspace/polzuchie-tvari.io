// ROLE: Лента убийств.
interface KillEvent {
  killer: string;
  victim: string;
}

interface KillFeedPayload {
  events: KillEvent[];
  players: Record<string, any>;
}

export class KillFeed {
  private container: HTMLDivElement;
  private panel: HTMLDivElement | null = null;
  private feedItems: { id: number; element: HTMLDivElement; time: number }[] = [];
  private cleanUpInterval = 0;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.render();
    this.bindEvents();
    this.startCleanupTimer();
  }

  public destroy(): void {
    window.removeEventListener("game-killfeed", this.handleKillFeedEvent as EventListener);
    clearInterval(this.cleanUpInterval);
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
  }

  private render(): void {
    this.panel = document.createElement("div");
    this.panel.className = "killfeed-panel hud-interactive";
    this.container.appendChild(this.panel);
  }

  private bindEvents(): void {
    window.addEventListener("game-killfeed", this.handleKillFeedEvent as EventListener);
  }

  private handleKillFeedEvent = (e: CustomEvent<KillFeedPayload>): void => {
    if (!this.panel) return;

    const { events, players } = e.detail;
    events.forEach((evt) => {
      const killerName = evt.killer ? (players[evt.killer]?.nickname || evt.killer) : "Wall";
      const victimName = players[evt.victim]?.nickname || evt.victim;

      const item = document.createElement("div");
      item.className = "kill-message";
      
      const killerEl = document.createElement("span");
      killerEl.className = "kill-killer";
      killerEl.textContent = killerName;
      
      const victimEl = document.createElement("span");
      victimEl.className = "kill-victim";
      victimEl.textContent = victimName;
      
      item.appendChild(killerEl);
      item.appendChild(document.createTextNode(" killed "));
      item.appendChild(victimEl);
      
      this.panel?.appendChild(item);
      this.feedItems.push({
        id: Date.now() + Math.random(),
        element: item,
        time: Date.now()
      });

      // Keep only last 5 items visually
      if (this.feedItems.length > 5) {
        const oldest = this.feedItems.shift();
        oldest?.element.remove();
      }
    });
  };

  private startCleanupTimer(): void {
    this.cleanUpInterval = window.setInterval(() => {
      const now = Date.now();
      this.feedItems = this.feedItems.filter((item) => {
        const isFresh = now - item.time < 5000;
        if (!isFresh) {
          item.element.style.opacity = "0";
          setTimeout(() => item.element.remove(), 300);
        }
        return isFresh;
      });
    }, 1000);
  }
}
