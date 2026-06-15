// ROLE: Экран смерти, показывающий статистику и кнопку респавна.
import { NetworkManager } from "../game/NetworkManager";

export class GameOverScreen {
  private container: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;
  private networkManager: NetworkManager;
  private myId: string = "";

  constructor(container: HTMLDivElement, networkManager: NetworkManager) {
    this.container = container;
    this.networkManager = networkManager;
    this.bindEvents();
  }

  public setMyId(id: string): void {
    this.myId = id;
  }

  public destroy(): void {
    window.removeEventListener("game-killfeed", this.handleKillFeed as EventListener);
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private bindEvents(): void {
    window.addEventListener("game-killfeed", this.handleKillFeed as EventListener);
  }

  private handleKillFeed = (e: CustomEvent): void => {
    if (!this.myId) return;
    const { events, players } = e.detail;

    for (const evt of events) {
      if (evt.victim === this.myId) {
        const pInfo = players[this.myId];
        this.show(pInfo);
        break;
      }
    }
  };

  private show(pInfo: any): void {
    if (this.overlay) return; // Already showing

    const score = pInfo?.score || 0;
    const kills = pInfo?.kills || 0;

    this.overlay = document.createElement("div");
    this.overlay.className = "game-over-overlay hud-interactive";
    
    this.overlay.innerHTML = `
      <div class="game-over-modal glass-panel">
        <h1 class="game-over-title">ПОТРАЧЕНО</h1>
        <p class="game-over-subtitle">Твоя змейка стала кормом для других.</p>
        
        <div class="game-over-stats">
          <div class="stat-box">
            <div class="stat-label">Длина</div>
            <div class="stat-value stat-score">${Math.floor(score)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Фраги</div>
            <div class="stat-value stat-kills">${kills}</div>
          </div>
        </div>
        
        <button id="respawn-btn" class="respawn-btn">
          ИГРАТЬ СНОВА
        </button>
      </div>
    `;

    this.container.appendChild(this.overlay);

    const btn = this.overlay.querySelector("#respawn-btn") as HTMLButtonElement;
    btn.addEventListener("click", () => {
      this.networkManager.send("RESPAWN");
      this.hide();
    });
  }

  private hide(): void {
    if (this.overlay) {
      this.overlay.style.opacity = "0";
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }
  }
}
