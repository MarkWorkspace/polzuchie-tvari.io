// ROLE: Генерация HTML шаблона панели администратора и модальных окон.
import { NEW_SECTIONS } from "./AdminLabels";

export class AdminDashboard {
  public static render(activeTab: string, searchQuery: string, healthData: any, hasChanges: boolean, modifiedCount: number, showRestartConfirm: boolean): string {
    return `
      <div class="admin-panel-layout" style="display: flex; flex-direction: column; height: 100vh; padding: 20px; gap: 20px; background: var(--bg-dark); box-sizing: border-box; overflow: hidden;">
        <header class="glass-panel" style="padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-shrink: 0;">
          <div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #fff, var(--accent-pink)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Admin Dashboard</h2>
            <div id="server-health" style="font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; margin-top: 4px; align-items: center;">
              ${AdminDashboard.renderHealth(healthData)}
            </div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <div style="position: relative; display: flex; align-items: center;">
              <input type="text" id="admin-search" placeholder="Search parameters..." value="${searchQuery}" class="input-field" style="padding: 8px 32px 8px 12px; font-size: 13px; width: 180px; height: 34px; box-sizing: border-box;" />
              ${searchQuery ? '<span id="clear-search-btn" style="position: absolute; right: 10px; cursor: pointer; color: var(--text-muted); font-size: 12px;">✕</span>' : ""}
            </div>
            <a href="/?debug=true" class="login-button" style="background: rgba(230,57,70,0.15); border: 1px solid #e63946; color: #e63946; padding: 8px 14px; font-size: 13px; margin: 0; text-decoration: none; display: inline-block; line-height: 1.2;">🐛 Debug</a>
            <button id="restart-srv-btn" class="login-button" style="background: #e63946; padding: 8px 14px; font-size: 13px; margin: 0; line-height: 1.2;">🔄 Restart</button>
          </div>
        </header>

        <div style="display: flex; gap: 20px; flex: 1; min-height: 0;">
          <aside class="glass-panel" style="width: 210px; display: flex; flex-direction: column; padding: 12px; gap: 8px; flex-shrink: 0; box-sizing: border-box;">
            ${AdminDashboard.renderTabBtn("all", "🗂️ All Settings", activeTab, modifiedCount)}
            ${Object.entries(NEW_SECTIONS).map(([k, v]) => AdminDashboard.renderTabBtn(k, `${v.icon} ${v.title}`, activeTab, 0)).join("")}
            <div style="flex: 1;"></div>
            <button id="exit-admin-btn" class="login-button" style="padding: 10px; font-size: 12px; background: rgba(255,255,255,0.05); margin: 0;">Exit Dashboard</button>
          </aside>

          <main class="glass-panel" style="flex: 1; display: flex; flex-direction: column; padding: 20px; min-height: 0; box-sizing: border-box; overflow: hidden; position: relative;">
            <div style="flex: 1; overflow-y: auto; padding-right: 4px;" id="admin-main-view"></div>
          </main>
        </div>
      </div>
      ${hasChanges ? AdminDashboard.renderFloatingPanel(modifiedCount) : ""}
      ${showRestartConfirm ? AdminDashboard.renderRestartModal() : ""}
    `;
  }

  private static renderHealth(h: any): string {
    if (!h.online) return `<span style="color: #f87171; display: flex; align-items: center; gap: 5px;"><span class="pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #f87171; display: inline-block;"></span>Server: offline</span>`;
    return `
      <span style="color: #4ade80; display: flex; align-items: center; gap: 5px;"><span class="pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; display: inline-block;"></span>Server: online</span>
      <span style="color: var(--text-muted);">|</span>
      <span>Players: ${h.players}</span>
      <span style="color: var(--text-muted);">|</span>
      <span>Ping: <strong style="color: ${h.ping <= 75 ? "#4ade80" : h.ping <= 150 ? "#fbbf24" : "#f87171"};">${h.ping} ms</strong></span>
    `;
  }

  private static renderTabBtn(tab: string, label: string, activeTab: string, count: number): string {
    const active = activeTab === tab;
    const bg = active ? "var(--accent-pink)" : "transparent";
    return `
      <button class="tab-btn login-button" data-tab="${tab}" style="text-align: left; background: ${bg}; padding: 10px 14px; font-size: 13px; border-radius: 8px; margin: 0; box-shadow: none; display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box;">
        <span>${label}</span>
        ${count > 0 ? `<span style="background: ${active ? "#fff" : "#f59e0b"}; color: ${active ? "var(--accent-pink)" : "#1e2025"}; padding: 1px 6px; border-radius: 10px; font-size: 11px; font-weight: 700; margin-left: 6px;">+${count}</span>` : ""}
      </button>
    `;
  }

  private static renderFloatingPanel(count: number): string {
    return `
      <div class="floating-action-panel" style="position: fixed; bottom: 30px; right: 30px; z-index: 1000; background: rgba(30, 32, 40, 0.98); border: 1px solid #f59e0b; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.2); width: 280px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 16px;">⚠️</span>
          <span style="font-size: 13px; font-weight: 700; color: #f59e0b;">Unsaved changes!</span>
        </div>
        <p style="margin: 0 0 12px; font-size: 11px; color: var(--text-muted); line-height: 1.4;">You have modified configuration parameters. Apply them to update the world in real-time.</p>
        <div style="display: flex; gap: 8px;">
          <button id="reset-config-btn" class="login-button" style="flex: 1; padding: 8px; font-size: 12px; margin: 0; background: transparent; border: 1px solid #f59e0b; color: #f59e0b;">Reset</button>
          <button id="save-config-btn" class="login-button" style="flex: 1.3; padding: 8px; font-size: 12px; margin: 0; background: linear-gradient(135deg, #e63946, #c92a3a); border: none; color: #fff; font-weight: 700;">Apply (${count})</button>
        </div>
      </div>
    `;
  }

  private static renderRestartModal(): string {
    return `
      <div style="position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px);">
        <div style="background: #16171b; border-radius: 12px; border: 1px solid rgba(245,158,11,0.3); padding: 24px; max-width: 380px; width: 90%; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.5);">
          <div style="font-size: 32px; margin-bottom: 10px;">⚠️</div>
          <h3 style="color: #f59e0b; font-size: 16px; font-weight: 700; margin: 0 0 8px;">Restart Game?</h3>
          <p style="color: var(--text-muted); font-size: 12px; line-height: 1.5; margin: 0 0 20px;">This will disconnect all players and reset the game state. Food will be respawned. Configuration settings are preserved.</p>
          <div style="display: flex; gap: 10px;">
            <button id="cancel-restart-btn" class="login-button" style="flex: 1; padding: 10px; font-size: 13px; margin: 0; background: rgba(255,255,255,0.06); border: 1px solid var(--border-glow);">Cancel</button>
            <button id="confirm-restart-btn" class="login-button" style="flex: 1; padding: 10px; font-size: 13px; margin: 0; background: #e63946; border: none; color: #fff; font-weight: 700;">Restart</button>
          </div>
        </div>
      </div>
    `;
  }
}
