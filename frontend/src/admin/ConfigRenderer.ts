// ROLE: Генерация HTML для полей конфигурации и видов еды. Без состояния.
import { NEW_SECTIONS, FIELD_LABELS, FIELD_UNITS, FIELD_TOOLTIPS, HIDDEN_FIELDS, getNewSectionKey } from "./AdminLabels";

export class ConfigRenderer {
  public static renderFields(config: any, drafts: Record<string, string>, foodTypes: any[], activeTab: string, searchQuery: string, formulaError: string | null): string {
    if (!config) return "Load configuration first.";
    const query = searchQuery.toLowerCase().trim();
    const allFields: any[] = [];
    for (const [section, values] of Object.entries(config)) {
      for (const [key, value] of Object.entries(values as any)) {
        if (HIDDEN_FIELDS.has(key) || key === "width" || key === "height") continue;
        allFields.push({ section, key, value, label: FIELD_LABELS[key] || key, dk: `${section}.${key}` });
      }
    }
    const filtered = allFields.filter(f => !query || f.label.toLowerCase().includes(query) || f.key.toLowerCase().includes(query) || (NEW_SECTIONS[getNewSectionKey(f.section)]?.title || "").toLowerCase().includes(query));
    const activeFields = filtered.filter(f => activeTab === "all" || (NEW_SECTIONS[activeTab]?.old_sections || []).includes(f.section));
    const grouped: Record<string, any[]> = {};
    activeFields.forEach(f => {
      const newSec = getNewSectionKey(f.section);
      grouped[newSec] = grouped[newSec] || [];
      grouped[newSec].push(f);
    });

    let html = '<div class="admin-content-layout" style="display: flex; flex-direction: column; gap: 24px;">';
    Object.entries(NEW_SECTIONS).forEach(([secKey, secInfo]) => {
      const fields = grouped[secKey] || [];
      const isWorldNet = secKey === "world_network";
      const hasMapSize = isWorldNet && (activeTab === "world_network" || activeTab === "all") && (!query || "map size width height".includes(query));
      if (fields.length === 0 && !hasMapSize) return;

      if (activeTab === "all" || query) {
        html += `<div style="display: flex; align-items: center; gap: 8px; border-bottom: 2px solid var(--border-glow); padding-bottom: 6px; margin-top: 10px;">
          <span style="font-size: 18px;">${secInfo.icon}</span>
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-primary);">${secInfo.title}</h3>
        </div>`;
      }
      html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px;">';
      if (hasMapSize) html += ConfigRenderer.renderMapSizeCard(config, drafts);
      fields.forEach(f => { html += ConfigRenderer.renderFieldInput(f, drafts, formulaError); });
      html += "</div>";

      if (secKey === "world_network" && (activeTab === "world_network" || activeTab === "all") && !query) {
        html += `<div class="config-card" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff;">🗺️ Map Simulation</h3>
            <button id="regenerate-sim-btn" class="login-button" style="padding: 6px 12px; font-size: 12px; margin: 0; background: rgba(255,255,255,0.06);">🎲 Roll Seed</button>
          </div>
          <div style="position: relative; background: #16171b; border-radius: 8px; padding: 12px; min-height: 200px; display: flex; justify-content: center; align-items: center; border: 1px solid var(--border-glow);">
            <canvas id="sim-canvas" style="display: block; border-radius: 6px; max-width: 100%; max-height: 350px;"></canvas>
          </div>
          <div id="sim-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-glow); padding-top: 10px;"></div>
        </div>`;
      }
      if (secKey === "food_boost" && (activeTab === "food_boost" || activeTab === "all") && !query) {
        html += ConfigRenderer.renderFoodTypesEditor(foodTypes, config.food?.types || []);
      }
    });
    html += "</div>";
    return html;
  }

  private static renderMapSizeCard(config: any, drafts: Record<string, string>): string {
    const wDraft = drafts["world.width"] ?? String(config.world.width);
    const hDraft = drafts["world.height"] ?? String(config.world.height);
    const isMody = wDraft !== String(config.world.width) || hDraft !== String(config.world.height);
    return `<div class="config-card ${isMody ? "modified" : ""}" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #fff; font-size: 13px; font-weight: 600;">Map Size</span>
            <div class="tooltip-container"><span class="tooltip-icon">?</span><div class="tooltip-text">The width and height of the game board in cells.</div></div>
          </div>
          ${isMody ? '<span style="color: #f59e0b; font-size: 10px; font-weight: 700; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 10px;">modified</span>' : ""}
        </div>
        <div style="font-family: monospace; font-size: 10px; color: var(--text-muted); margin-bottom: 12px;">world.width × world.height</div>
      </div>
      <div>
        ${isMody ? `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
          <span>Was: <strong style="color: #888;">${config.world.width} × ${config.world.height}</strong></span>
          <button type="button" class="reset-field-btn" data-key="world.width,world.height" style="background: none; border: none; color: #f59e0b; cursor: pointer; text-decoration: underline; padding: 0;">Reset ↺</button>
        </div>` : ""}
        <div style="display: flex; align-items: center; gap: 8px;">
          <input value="${wDraft}" class="input-field config-input-field" data-key="world.width" style="flex: 1; min-width: 0; text-align: center; padding: 8px;" />
          <span style="color: var(--text-muted); font-weight: 700;">×</span>
          <input value="${hDraft}" class="input-field config-input-field" data-key="world.height" style="flex: 1; min-width: 0; text-align: center; padding: 8px;" />
          <span style="color: var(--text-muted); font-size: 11px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-glow); padding: 8px; border-radius: 6px;">cells</span>
        </div>
      </div>
    </div>`;
  }

  private static renderFieldInput(f: any, drafts: Record<string, string>, formulaError: string | null): string {
    const draftVal = drafts[f.dk] ?? String(f.value);
    const isMody = draftVal !== String(f.value);
    const tooltip = FIELD_TOOLTIPS[f.key] || "";
    const hasErr = f.key === "growth_score_per_segment" && formulaError;
    return `<div class="config-card ${isMody ? "modified" : ""}" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #fff; font-size: 13px; font-weight: 600;">${f.label}</span>
            ${tooltip ? `<div class="tooltip-container"><span class="tooltip-icon">?</span><div class="tooltip-text">${tooltip}</div></div>` : ""}
          </div>
          ${isMody ? '<span style="color: #f59e0b; font-size: 10px; font-weight: 700; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 10px;">modified</span>' : ""}
        </div>
        <div style="font-family: monospace; font-size: 10px; color: var(--text-muted); margin-bottom: 12px;">${f.dk}</div>
      </div>
      <div>
        ${isMody ? `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); margin-bottom: 6px;">
          <span>Was: <strong style="color: #888;">${f.value}</strong></span>
          <button type="button" class="reset-field-btn" data-key="${f.dk}" style="background: none; border: none; color: #f59e0b; cursor: pointer; text-decoration: underline; padding: 0;">Reset ↺</button>
        </div>` : ""}
        <div style="display: flex; align-items: center; gap: 8px;">
          <input value="${draftVal}" class="input-field config-input-field" data-key="${f.dk}" style="flex: 1; min-width: 0; padding: 8px; border-color: ${hasErr ? "#ef4444" : ""};" />
          ${FIELD_UNITS[f.key] ? `<span style="color: var(--text-muted); font-size: 11px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-glow); padding: 8px; border-radius: 6px; min-width: 48px; text-align: center;">${FIELD_UNITS[f.key]}</span>` : ""}
        </div>
        ${hasErr ? `<div style="color: #f87171; font-size: 10px; margin-top: 6px; background: rgba(239,68,68,0.08); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.2); line-height: 1.3;">⚠️ <strong>Error:</strong> ${formulaError}</div>` : ""}
      </div>
    </div>`;
  }

  private static renderFoodTypesEditor(foodTypes: any[], originalTypes: any[]): string {
    const isMody = JSON.stringify(foodTypes.map(t => ({ value: t.value, weight: t.weight, color: t.color, image: t.image }))) !== JSON.stringify(originalTypes);
    let html = `<div class="config-card" style="margin-top: 12px; display: flex; flex-direction: column; gap: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>🍎 Food Types & Spawning Settings</span>
            ${isMody ? '<span style="color: #f59e0b; font-size: 10px; font-weight: 700; background: rgba(245,158,11,0.15); padding: 2px 6px; border-radius: 10px; text-transform: uppercase; font-family: sans-serif; letter-spacing: 0.5px;">modified</span>' : ""}
          </h3>
          <p style="margin: 4px 0 0; color: var(--text-muted); font-size: 12px;">Spawn weights and colors for different food types.</p>
        </div>
        <button id="add-food-type-btn" class="login-button" style="padding: 6px 12px; font-size: 12px; margin: 0; background: rgba(230,57,70,0.1); border: 1px solid #e63946; color: #e63946;">+ Add Food Type</button>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">`;

    foodTypes.forEach((ft, i) => {
      const orig = originalTypes[i];
      const isRowMody = !orig || orig.value !== ft.value || orig.weight !== ft.weight || orig.color !== ft.color;
      html += `<div class="food-card" style="border: 1px solid ${isRowMody ? "#f59e0b" : "var(--border-glow)"}; border-radius: 8px; background: rgba(0,0,0,0.15); overflow: hidden;">
        <div class="food-card-header" data-idx="${i}" style="display: flex; align-items: center; gap: 10px; padding: 12px; cursor: pointer; background: rgba(255,255,255,0.02); user-select: none;">
          <span style="width: 14px; height: 14px; border-radius: 50%; background: ${ft.color}; border: 1.5px solid rgba(255,255,255,0.25);"></span>
          <div style="flex: 1;">
            <div style="font-size: 13px; font-weight: 600; color: #fff;">Value: ${ft.value} pts ${ft.image ? `(🖼️ ${ft.image})` : ""}</div>
            <div style="font-size: 11px; color: var(--text-muted);">Spawn weight: ${ft.weight}</div>
          </div>
          <button class="remove-food-type-btn" data-idx="${i}" style="background: none; border: none; color: #e63946; cursor: pointer; font-size: 16px; padding: 0 4px;">✕</button>
          <span style="color: var(--text-muted); font-size: 10px;">${ft.expanded ? "▲" : "▼"}</span>
        </div>
        ${ft.expanded ? `<div style="padding: 12px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border-glow); background: rgba(0,0,0,0.25);">
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="color: var(--text-muted); font-size: 11px;">Points Value</span>
            <input value="${ft.value}" class="input-field food-type-val" data-idx="${i}" type="number" style="padding: 8px;" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="color: var(--text-muted); font-size: 11px;">Spawn Weight</span>
            <input value="${ft.weight}" class="input-field food-type-weight" data-idx="${i}" type="number" style="padding: 8px;" />
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="color: var(--text-muted); font-size: 11px;">Color</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="color" value="${ft.color}" class="food-type-color-picker" data-idx="${i}" style="width: 36px; height: 34px; border: 1px solid var(--border-glow); border-radius: 6px; cursor: pointer; background: transparent; padding: 0;" />
              <input value="${ft.color}" class="input-field food-type-color" data-idx="${i}" style="flex: 1; padding: 8px; font-family: monospace;" />
            </div>
          </label>
          <label style="display: flex; flex-direction: column; gap: 4px;">
            <span style="color: var(--text-muted); font-size: 11px;">Image (SVG filename)</span>
            <input value="${ft.image || ""}" class="input-field food-type-image" data-idx="${i}" placeholder="e.g. apple.svg" style="padding: 8px;" />
            ${ft.image ? `<div style="display: flex; align-items: center; margin-top: 4px; padding: 4px; border-radius: 4px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-glow); width: fit-content;"><img src="/${ft.image}" style="width: 32px; height: 32px; object-fit: contain;" /></div>` : ""}
          </label>
        </div>` : ""}
      </div>`;
    });
    html += "</div></div>";
    return html;
  }
}
