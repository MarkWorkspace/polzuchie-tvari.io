// ROLE: Боковая панель настроек / Меню.
import { InputManager } from "../game/InputManager";
import type { ControlMode } from "../game/InputManager";
import { t } from "../lib/i18n";
import { Leaderboard } from "./Leaderboard";

interface SettingsCallbacks {
  onDebugToggle: () => void;
  onAdminClick: () => void;
}

export class SettingsPanel {
  private container: HTMLDivElement;
  private inputManager: InputManager;
  private callbacks: SettingsCallbacks;

  private triggerBtn: HTMLDivElement | null = null;
  private overlay: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private contentDiv: HTMLDivElement | null = null;
  private leaderboardContainer: HTMLDivElement | null = null;
  private leaderboard: Leaderboard | null = null;
  
  private isOpen = false;
  private isMobile = false;

  constructor(container: HTMLDivElement, inputManager: InputManager, callbacks: SettingsCallbacks) {
    this.container = container;
    this.inputManager = inputManager;
    this.callbacks = callbacks;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    this.render();
  }

  public destroy(): void {
    if (this.triggerBtn) this.triggerBtn.remove();
    if (this.panel) this.panel.remove();
    if (this.overlay) this.overlay.remove();
    if (this.leaderboard) this.leaderboard.destroy();
  }

  private render(): void {
    // Backdrop overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "settings-overlay";
    this.overlay.addEventListener("click", () => this.togglePanel(false));
    this.container.appendChild(this.overlay);

    // Side panel
    this.panel = document.createElement("div");
    this.panel.className = "settings-drawer custom-scrollbar";
    this.panel.style.overflowY = "auto";
    this.container.appendChild(this.panel);

    this.contentDiv = document.createElement("div");
    this.panel.appendChild(this.contentDiv);

    this.leaderboardContainer = document.createElement("div");
    this.leaderboardContainer.style.marginTop = "24px";
    this.leaderboardContainer.style.borderTop = "1px solid rgba(255, 255, 255, 0.08)";
    this.leaderboardContainer.style.paddingTop = "20px";
    this.panel.appendChild(this.leaderboardContainer);

    this.leaderboard = new Leaderboard(this.leaderboardContainer, { 
      limit: 10, 
      alwaysOpen: true,
      noBackground: true
    });

    // Trigger button
    this.triggerBtn = document.createElement("div");
    this.triggerBtn.className = "settings-trigger";
    this.triggerBtn.innerHTML = "☰";
    this.triggerBtn.addEventListener("click", () => this.togglePanel(true));
    this.container.appendChild(this.triggerBtn);
  }

  private togglePanel(force?: boolean): void {
    this.isOpen = force !== undefined ? force : !this.isOpen;
    if (!this.panel || !this.overlay) return;
    
    if (this.isOpen) {
      this.panel.classList.add("open");
      this.overlay.classList.add("visible");
      this.refreshPanelContent();
    } else {
      this.panel.classList.remove("open");
      this.overlay.classList.remove("visible");
    }
  }

  private refreshPanelContent(): void {
    if (!this.contentDiv) return;

    const currentMode = this.inputManager.getControlMode();

    this.contentDiv.innerHTML = `
      <div class="drawer-header">
        <span class="drawer-title">${t("menu.title") || "Settings"}</span>
        <div class="drawer-close" id="drawer-close">✕</div>
      </div>

      <div class="drawer-section">
        <h3 class="drawer-section-title">${t("menu.controls") || "CONTROLS"}</h3>
        <div class="drawer-control-list">
          ${this.isMobile ? "" : this.createControlOption("keyboard", "⌨️", t("control.keyboard") || "Keyboard", t("control.keyboardDesc") || "A/D or Arrows", currentMode)}
          ${this.createControlOption("mouse", "👆", t("control.touchDrag") || (this.isMobile ? "Touch Steer" : "Mouse Steer"), t("control.touchDragDesc") || (this.isMobile ? "Drag to steer" : "Move mouse to steer"), currentMode)}
          ${this.isMobile ? this.createControlOption("tilt", "📱", t("control.tilt") || "Tilt Steer", t("control.tiltDesc") || "Tilt device", currentMode) : ""}
        </div>
      </div>

      <div class="drawer-guide">
        <h3 class="drawer-section-title">${t("menu.guide") || "GUIDE"}</h3>
        <div class="drawer-guide-content">
          <div>• ${currentMode === "tilt" ? (t("guide.tiltSteer") || "Tilt to steer") : currentMode === "keyboard" ? (t("guide.keySteer") || "Use A/D or Arrows to steer") : (t("guide.touchSteer") || (this.isMobile ? "Drag to steer" : "Move mouse to steer"))}</div>
          <div>• ${currentMode === "keyboard" ? (t("guide.keyBoost") || "Space to boost") : (t("guide.touchBoost") || (this.isMobile ? "Touch bottom to boost" : "Click to boost"))}</div>
          <div>• ${t("guide.collectFood") || "Eat food to grow"}</div>
          <div>• ${t("guide.collision") || "Don't hit walls"}</div>
        </div>
      </div>

      <a href="#" class="drawer-admin-link" id="admin-panel-btn">
        <span>⚙️</span> Admin Panel
      </a>
    `;

    this.bindPanelEvents();
  }

  private createControlOption(mode: string, icon: string, title: string, desc: string, currentMode: ControlMode): string {
    const isActive = mode === currentMode;
    const activeClass = isActive ? "active" : "";
    return `
      <div class="drawer-control-option ${activeClass}" id="mode-btn-${mode}">
        <span class="control-icon">${icon}</span>
        <div class="control-text">
          <span class="control-title">${title}</span>
          <span class="control-desc">${desc}</span>
        </div>
      </div>
    `;
  }

  private bindPanelEvents(): void {
    this.contentDiv?.querySelector("#drawer-close")?.addEventListener("click", () => this.togglePanel(false));

    const modes: ControlMode[] = ["keyboard", "mouse"];
    if (this.isMobile) modes.push("tilt");

    modes.forEach((mode) => {
      this.contentDiv?.querySelector(`#mode-btn-${mode}`)?.addEventListener("click", () => {
        this.inputManager.setControlMode(mode);
        this.refreshPanelContent();
      });
    });

    this.contentDiv?.querySelector("#admin-panel-btn")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.callbacks.onAdminClick();
    });
  }
}
