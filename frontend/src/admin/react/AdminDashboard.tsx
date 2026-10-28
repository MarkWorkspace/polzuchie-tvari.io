// ROLE: React admin dashboard shell and configuration editor. Not game logic.

import { FIELD_LABELS, getNewSectionKey, HIDDEN_FIELDS, NEW_SECTIONS } from "../AdminLabels";
import type { ConfigEditor } from "../ConfigEditor";
import { ConfigField, type ConfigFieldData } from "./ConfigField";
import { FoodTypesEditor } from "./FoodTypesEditor";
import { MapSimulator } from "./MapSimulator";
import { MapSizeCard } from "./MapSizeCard";
import { RestartModal } from "./RestartModal";

export type AdminTab = "all" | keyof typeof NEW_SECTIONS;

export interface ServerHealth {
  online: boolean;
  players: number;
  bots: number;
  ping: number;
}

export interface AdminNotice {
  kind: "success" | "error" | "info";
  text: string;
}

interface AdminDashboardProps {
  editor: ConfigEditor;
  revision: number;
  tab: AdminTab;
  query: string;
  health: ServerHealth;
  notice: AdminNotice | null;
  formulaError: string | null;
  restartOpen: boolean;
  onTabChange: (tab: AdminTab) => void;
  onQueryChange: (query: string) => void;
  onFieldChange: (draftKey: string, value: string) => void;
  onResetFields: (draftKeys: string[]) => void;
  onResetAll: () => void;
  onRefresh: () => void;
  onSave: () => void;
  onRestartClick: () => void;
  onRestartConfirm: () => void;
  onRestartCancel: () => void;
  onLogout: () => void;
  onNoticeClose: () => void;
}

export function AdminDashboard({
  editor,
  revision,
  tab,
  query,
  health,
  notice,
  formulaError,
  restartOpen,
  onTabChange,
  onQueryChange,
  onFieldChange,
  onResetFields,
  onResetAll,
  onRefresh,
  onSave,
  onRestartClick,
  onRestartConfirm,
  onRestartCancel,
  onLogout,
  onNoticeClose,
}: AdminDashboardProps) {
  const config = editor.getConfig();
  if (!config) return null;

  const counts = editor.getModifiedCounts();
  const drafts = editor.getDrafts();
  const fields = buildFields(config);
  const queryLower = query.trim().toLowerCase();
  const filtered = fields.filter((field) => {
    if (!queryLower) return true;
    const sectionTitle = NEW_SECTIONS[getNewSectionKey(field.section)]?.title ?? "";
    return (
      field.label.toLowerCase().includes(queryLower) ||
      field.key.toLowerCase().includes(queryLower) ||
      sectionTitle.toLowerCase().includes(queryLower)
    );
  });
  const activeFields = filtered.filter(
    (field) => tab === "all" || (NEW_SECTIONS[tab]?.old_sections ?? []).includes(field.section),
  );
  const grouped = groupFields(activeFields);
  const mapSizeVisible =
    (tab === "world_network" || tab === "all") &&
    (!queryLower || "map size width height".includes(queryLower));
  const mapSimulatorVisible = (tab === "world_network" || tab === "all") && !queryLower;
  const foodEditorVisible = (tab === "food_boost" || tab === "all") && !queryLower;

  return (
    <div className="admin-app">
      <header className="glass-panel admin-topbar">
        <div>
          <h1 className="admin-brand">Admin Dashboard</h1>
          <HealthStatus health={health} />
        </div>
        <div className="admin-toolbar">
          <label className="admin-search">
            <input
              className="input-field"
              type="search"
              placeholder="Search parameters..."
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label="Search configuration parameters"
            />
            {query ? (
              <button
                type="button"
                className="admin-search-clear"
                onClick={() => onQueryChange("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}
          </label>
          <a className="login-button admin-secondary-button" href="/?debug=true">
            🐛 Debug
          </a>
          <a
            className="login-button admin-secondary-button"
            href="/?spectator=debug"
            target="_blank"
            rel="noreferrer"
          >
            👁 Spectator
          </a>
          <button
            type="button"
            className="login-button admin-danger-button"
            onClick={onRestartClick}
          >
            🔄 Restart
          </button>
        </div>
      </header>

      <div className="admin-shell">
        <aside className="glass-panel admin-sidebar">
          <TabButton
            active={tab === "all"}
            label="🗂️ All Settings"
            count={counts.all}
            onClick={() => onTabChange("all")}
          />
          {Object.entries(NEW_SECTIONS).map(([key, section]) => (
            <TabButton
              key={key}
              active={tab === key}
              label={`${section.icon} ${section.title}`}
              count={counts[key] ?? 0}
              onClick={() => onTabChange(key as AdminTab)}
            />
          ))}
          <div className="admin-sidebar-spacer" />
          <button type="button" className="login-button admin-secondary-button" onClick={onLogout}>
            Log out
          </button>
          <a className="login-button admin-secondary-button" href="/">
            Exit Dashboard
          </a>
        </aside>

        <main className="glass-panel admin-main">
          {notice ? (
            <div className={`admin-notice is-${notice.kind}`} role="status">
              <span>{notice.text}</span>
              <button type="button" onClick={onNoticeClose} aria-label="Dismiss message">
                ✕
              </button>
            </div>
          ) : null}

          <div className="admin-scroll">
            {Object.entries(NEW_SECTIONS).map(([sectionKey, section]) => {
              const sectionFields = grouped[sectionKey] ?? [];
              const isWorld = sectionKey === "world_network";
              const isFood = sectionKey === "food_boost";
              if (sectionFields.length === 0 && !(isWorld && mapSizeVisible)) return null;

              return (
                <section className="admin-section" key={sectionKey}>
                  {tab === "all" || queryLower ? (
                    <div className="admin-section-heading">
                      <span>{section.icon}</span>
                      <h2>{section.title}</h2>
                    </div>
                  ) : null}

                  <div className="admin-fields-grid">
                    {isWorld && mapSizeVisible ? (
                      <MapSizeCard
                        width={drafts["world.width"] ?? String(config.world.width)}
                        height={drafts["world.height"] ?? String(config.world.height)}
                        originalWidth={config.world.width}
                        originalHeight={config.world.height}
                        onChange={onFieldChange}
                        onReset={() => onResetFields(["world.width", "world.height"])}
                      />
                    ) : null}
                    {sectionFields.map((field) => (
                      <ConfigField
                        key={field.draftKey}
                        field={field}
                        draftValue={drafts[field.draftKey] ?? String(field.value)}
                        formulaError={formulaError}
                        onChange={onFieldChange}
                        onReset={onResetFields}
                      />
                    ))}
                  </div>

                  {isWorld && mapSimulatorVisible ? (
                    <MapSimulator
                      editor={editor}
                      revision={revision}
                      visible={mapSimulatorVisible}
                    />
                  ) : null}
                  {isFood && foodEditorVisible ? (
                    <FoodTypesEditor
                      editor={editor}
                      originalTypes={config.food?.types ?? []}
                      onChange={onRefresh}
                    />
                  ) : null}
                </section>
              );
            })}

            {activeFields.length === 0 && !mapSizeVisible ? (
              <div className="admin-empty">No parameters match this filter.</div>
            ) : null}
          </div>
        </main>
      </div>

      {counts.all > 0 ? (
        <div className="admin-floating-panel">
          <div className="admin-floating-title">⚠️ Unsaved changes!</div>
          <p>You have modified configuration parameters. Apply them to update the world.</p>
          <div className="admin-floating-actions">
            <button
              type="button"
              className="login-button admin-secondary-button"
              onClick={onResetAll}
            >
              Reset
            </button>
            <button type="button" className="login-button admin-primary-button" onClick={onSave}>
              Apply ({counts.all})
            </button>
          </div>
        </div>
      ) : null}

      {restartOpen ? (
        <RestartModal onCancel={onRestartCancel} onConfirm={onRestartConfirm} />
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`admin-tab ${active ? "is-active" : ""}`} onClick={onClick}>
      <span>{label}</span>
      {count > 0 ? <span className="admin-tab-badge">+{count}</span> : null}
    </button>
  );
}

function HealthStatus({ health }: { health: ServerHealth }) {
  if (!health.online) {
    return (
      <div className="admin-health">
        <span className="admin-health-dot is-offline" />
        Server: <strong className="is-offline">offline</strong>
      </div>
    );
  }
  return (
    <div className="admin-health">
      <span className="admin-health-dot" />
      Server: <strong className="is-online">online</strong>
      <span className="admin-health-separator">|</span>
      <span>Players: {health.players}</span>
      <span className="admin-health-separator">|</span>
      <span>Bots: {health.bots}</span>
      <span className="admin-health-separator">|</span>
      <span>
        Ping: <strong className={pingClass(health.ping)}>{health.ping} ms</strong>
      </span>
    </div>
  );
}

function pingClass(ping: number): string {
  if (ping <= 75) return "is-online";
  if (ping <= 150) return "is-warning";
  return "is-offline";
}

function buildFields(config: Record<string, Record<string, unknown>>): ConfigFieldData[] {
  const fields: ConfigFieldData[] = [];
  for (const [section, values] of Object.entries(config)) {
    for (const [key, value] of Object.entries(values)) {
      if (HIDDEN_FIELDS.has(key) || key === "width" || key === "height") continue;
      fields.push({
        section,
        key,
        value,
        label: FIELD_LABELS[key] ?? key,
        draftKey: `${section}.${key}`,
      });
    }
  }
  return fields;
}

function groupFields(fields: ConfigFieldData[]): Record<string, ConfigFieldData[]> {
  const grouped: Record<string, ConfigFieldData[]> = {};
  for (const field of fields) {
    const section = getNewSectionKey(field.section);
    grouped[section] ??= [];
    grouped[section].push(field);
  }
  return grouped;
}
