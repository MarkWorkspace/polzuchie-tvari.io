// ROLE: Точка входа панели администратора, оркестрация событий и здоровья сервера.
import { ConfigEditor } from "./ConfigEditor";
import { FoodSimulator } from "./FoodSimulator";
import { AdminDashboard } from "./AdminDashboard";
import { ConfigRenderer } from "./ConfigRenderer";

export class AdminPanel {
  private container: HTMLDivElement;
  private editor: ConfigEditor | null = null;
  private simulator: FoodSimulator | null = null;
  private activeTab = "world_network";
  private searchQuery = "";
  private healthData = { online: false, players: 0, ping: 0 };
  private healthInterval = 0;
  private simSeed = 42;
  private formulaError: string | null = null;
  private showRestartConfirm = false;

  constructor(container: HTMLDivElement) {
    this.container = container;
    const pwd = localStorage.getItem("snake-admin-password") || "";
    if (pwd) {
      this.editor = new ConfigEditor();
      this.initDashboard();
    } else {
      this.renderPasswordPrompt();
    }
  }

  public destroy(): void { clearInterval(this.healthInterval); }

  private renderPasswordPrompt(): void {
    this.container.innerHTML = `<div class="login-overlay"><div class="login-card glass-panel"><h2 class="login-logo">Admin Portal</h2><div class="login-form"><input type="password" id="admin-pass" class="input-field" placeholder="Enter Admin Password" autofocus /><button id="admin-auth-btn" class="login-button">Authorize</button><div id="auth-status" style="font-size: 12px; color: var(--text-muted);">Enter password to continue</div></div></div></div>`;
    const auth = async () => {
      const input = this.container.querySelector("#admin-pass") as HTMLInputElement;
      const pwd = input.value.trim();
      const host = window.location.hostname || "127.0.0.1";
      const isStd = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
      const url = isStd ? `${window.location.protocol}//${host}/admin/login` : `${window.location.protocol}//${host}:8000/admin/login`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pwd }),
          credentials: "include"
        });
        if (!res.ok) {
          const statusText = document.getElementById("auth-status");
          if (statusText) {
             statusText.textContent = "Invalid password";
             statusText.style.color = "#ef4444";
          }
          return;
        }
        localStorage.setItem("snake-admin-password", pwd);
        this.editor = new ConfigEditor();
        this.initDashboard();
      } catch (e) {
        alert("Connection error");
      }
    };
    this.container.querySelector("#admin-auth-btn")?.addEventListener("click", () => void auth());
    this.container.querySelector("#admin-pass")?.addEventListener("keydown", (e) => (e as KeyboardEvent).key === "Enter" && auth());
  }

  private async initDashboard(): Promise<void> {
    const status = await this.editor!.load();
    if (status !== "OK") {
      alert(status);
      localStorage.removeItem("snake-admin-password");
      this.renderPasswordPrompt();
      return;
    }
    this.render();
    this.startHealthPolling();
    this.bindEvents();
  }

  private render(): void {
    const counts = this.editor!.getModifiedCounts();
    this.container.innerHTML = AdminDashboard.render(this.activeTab, this.searchQuery, this.healthData, counts.all > 0, counts.all, this.showRestartConfirm);
    const mainView = this.container.querySelector("#admin-main-view") as HTMLElement;
    if (mainView) {
      mainView.innerHTML = ConfigRenderer.renderFields(this.editor!.getConfig(), this.editor!.getDrafts(), this.editor!.getFoodTypes(), this.activeTab, this.searchQuery, this.formulaError);
      this.runSimulation();
    }
  }

  private runSimulation(newSeed?: boolean): void {
    const canvas = this.container.querySelector("#sim-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    if (newSeed) this.simSeed = Math.floor(Math.random() * 1000);
    this.simulator = new FoodSimulator(canvas);
    const simCfg = this.editor!.getSimConfig();
    this.simulator.simulateAndDraw(simCfg, this.simSeed);
    const stats = this.container.querySelector("#sim-stats");
    if (stats) {
      stats.innerHTML = `<div>Grid Size: <strong>${simCfg.width}x${simCfg.height}</strong></div><div>Food Count: <strong>${simCfg.target_food_count}</strong></div><div>Clusters: <strong>${simCfg.cluster_count}</strong></div><div>Cluster Spread: <strong>${simCfg.cluster_spread}</strong></div>`;
    }
  }

  private bindEvents(): void {
    this.container.addEventListener("input", (e) => {
      const el = e.target as HTMLInputElement;
      if (el.classList.contains("config-input-field")) {
        this.editor!.setDraft(el.dataset.key!, el.value);
        if (el.dataset.key === "growth_score_per_segment") this.formulaError = null;
        this.runSimulation();
        const counts = this.editor!.getModifiedCounts();
        
        const floatingPanel = this.container.querySelector("#floating-action-panel") as HTMLElement;
        if (floatingPanel) {
          floatingPanel.style.display = counts.all > 0 ? "block" : "none";
        }
        
        const applyBtn = this.container.querySelector("#save-config-btn");
        if (applyBtn) applyBtn.textContent = `Apply (${counts.all})`;
        
        const tabBtn = this.container.querySelector(`.tab-btn[data-tab="all"]`);
        if (tabBtn && counts.all > 0) {
          if (!tabBtn.querySelector("span:nth-child(2)")) {
            tabBtn.innerHTML += `<span style="background: ${this.activeTab === "all" ? "#fff" : "#f59e0b"}; color: ${this.activeTab === "all" ? "var(--accent)" : "#1e2025"}; padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 700; margin-left: 6px;">+${counts.all}</span>`;
          } else {
            const badge = tabBtn.querySelector("span:nth-child(2)") as HTMLElement;
            badge.textContent = `+${counts.all}`;
          }
        }
      } else if (el.id === "admin-search") {
        this.searchQuery = el.value;
        this.render();
        const searchEl = this.container.querySelector("#admin-search") as HTMLInputElement;
        searchEl.focus();
        searchEl.setSelectionRange(el.value.length, el.value.length);
      } else if (el.classList.contains("food-type-val") || el.classList.contains("food-type-weight") || el.classList.contains("food-type-color") || el.classList.contains("food-type-color-picker") || el.classList.contains("food-type-image")) {
        const idx = parseInt(el.dataset.idx!);
        const isColor = el.classList.contains("food-type-color") || el.classList.contains("food-type-color-picker");
        const isImage = el.classList.contains("food-type-image");
        const key = el.classList.contains("food-type-val") ? "value" : (isColor ? "color" : (isImage ? "image" : "weight"));
        this.editor!.updateFoodType(idx, key, (isColor || isImage) ? el.value : (Number(el.value) || 0));
        
        // Save selection state before rendering
        let selectionStart = 0, selectionEnd = 0, className = "";
        if (!el.classList.contains("food-type-color-picker")) {
            selectionStart = el.selectionStart || 0;
            selectionEnd = el.selectionEnd || 0;
            className = Array.from(el.classList).find(c => c.startsWith("food-type-")) || "";
        }
        
        this.render();
        
        // Restore focus
        if (className) {
            const restoredEl = this.container.querySelector(`.${className}[data-idx="${idx}"]`) as HTMLInputElement;
            if (restoredEl) {
                restoredEl.focus();
                restoredEl.setSelectionRange(selectionStart, selectionEnd);
            }
        }
      }
    });

    this.container.addEventListener("click", async (e) => {
      const btn = (e.target as HTMLElement).closest("button, a, .tab-btn, .food-card-header, #clear-search-btn") as HTMLElement;
      if (!btn) return;
      if (btn.classList.contains("tab-btn")) {
        this.activeTab = btn.getAttribute("data-tab")!;
        this.render();
      } else if (btn.id === "clear-search-btn") {
        this.searchQuery = "";
        this.render();
      } else if (btn.classList.contains("reset-field-btn")) {
        btn.getAttribute("data-key")!.split(",").forEach(k => this.editor!.setDraft(k, this.editor!.getConfig()[k.split(".")[0]][k.split(".")[1]]));
        this.render();
      } else if (btn.id === "save-config-btn") {
        const msg = await this.editor!.save();
        this.formulaError = (msg.includes("Error") || msg.toLowerCase().includes("formula") || msg.toLowerCase().includes("syntax")) ? msg : null;
        alert(msg);
        this.render();
      } else if (btn.id === "reset-config-btn") {
        this.editor!.resetLocalDrafts();
        this.formulaError = null;
        this.render();
      } else if (btn.id === "regenerate-sim-btn") {
        this.runSimulation(true);
      } else if (btn.id === "restart-srv-btn") {
        this.showRestartConfirm = true;
        this.render();
      } else if (btn.id === "cancel-restart-btn") {
        this.showRestartConfirm = false;
        this.render();
      } else if (btn.id === "confirm-restart-btn") {
        await this.restartServer();
        this.showRestartConfirm = false;
        this.render();
      } else if (btn.id === "add-food-type-btn") {
        this.editor!.addFoodType();
        this.render();
      } else if (btn.classList.contains("remove-food-type-btn")) {
        this.editor!.removeFoodType(parseInt(btn.dataset.idx!));
        this.render();
      } else if (btn.classList.contains("food-card-header")) {
        const idx = parseInt(btn.dataset.idx!);
        this.editor!.updateFoodType(idx, "expanded", !this.editor!.getFoodTypes()[idx].expanded);
        this.render();
      } else if (btn.id === "exit-admin-btn") {
        window.location.href = "/";
      }
    });
  }

  private async restartServer(): Promise<void> {
    try {
      const host = window.location.hostname || "127.0.0.1";
      const isStd = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
      const url = isStd ? `${window.location.protocol}//${host}/ws/admin/restart` : `${window.location.protocol}//${host}:8000/admin/restart`;
      const res = await fetch(url, { method: "POST", credentials: "include" });
      alert(res.ok ? "Server restarted successfully!" : "Restart failed: " + res.statusText);
    } catch (e) { alert("Restart error: " + String(e)); }
  }

  private startHealthPolling(): void {
    const poll = async () => {
      const start = performance.now();
      try {
        const host = window.location.hostname || "127.0.0.1";
        const isStd = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
        const url = isStd ? `${window.location.protocol}//${host}/ws/health` : `${window.location.protocol}//${host}:8000/health`;
        const res = await fetch(url);
        const data = await res.json();
        this.healthData = { online: true, players: data.players || 0, ping: Math.round(performance.now() - start) };
      } catch {
        this.healthData = { online: false, players: 0, ping: 0 };
      }
      const hEl = this.container.querySelector("#server-health");
      if (hEl) hEl.innerHTML = this.healthData.online 
        ? `<span style="display: flex; align-items: center; gap: 5px;"><span class="pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; display: inline-block;"></span>Server: <strong style="color: #4ade80; font-weight: 500;">online</strong></span><span style="color: var(--text-muted);">|</span><span>Players: ${this.healthData.players}</span><span style="color: var(--text-muted);">|</span><span>Ping: <strong style="color: ${this.healthData.ping <= 75 ? "#4ade80" : this.healthData.ping <= 150 ? "#fbbf24" : "#f87171"};">${this.healthData.ping} ms</strong></span>`
        : `<span style="display: flex; align-items: center; gap: 5px;"><span class="pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #f87171; display: inline-block;"></span>Server: <strong style="color: #f87171; font-weight: 500;">offline</strong></span>`;
    };
    poll();
    this.healthInterval = window.setInterval(poll, 2000);
  }
}
