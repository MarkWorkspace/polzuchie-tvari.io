"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";

type FoodTypeEntry = { value: number; weight: number; color: string };
type GameConfig = Record<string, Record<string, unknown>>;
type FoodTypeDraft = { value: string; weight: string; color: string; expanded: boolean };

const SECTION_TITLES: Record<string, string> = {
  world: "Мир",
  simulation: "Симуляция",
  snake: "Змейка",
  boost: "Ускорение",
  food: "Еда",
  network: "Сеть",
};

const FIELD_LABELS: Record<string, string> = {
  width: "Ширина карты",
  height: "Высота карты",
  target_food_count: "Целевое количество еды",
  food_overflow_limit: "Лимит лишней еды",
  cluster_count: "Количество кластеров",
  cluster_spawn_chance: "Шанс спавна в кластере",
  cluster_spread: "Разброс кластера",
  cluster_move_chance: "Шанс сдвига кластера за тик",
  tick_rate: "Тикрейт сервера",
  base_speed_per_second: "Скорость змейки",
  max_turn_speed_deg_per_second: "Макс. скорость поворота (°/с)",
  min_turn_radius: "Мин. радиус поворота",
  turn_radius_thickness_coeff: "Коэф. радиуса от толщины",
  turn_idle_smoothing_at_20hz: "Сглаживание выравнивания",
  turn_active_smoothing_at_20hz: "Сглаживание поворота",
  start_length: "Стартовая длина",
  start_score: "Стартовый счет",
  base_head_radius: "Минимальный радиус головы",
  score_radius_scale: "Рост радиуса от счета",
  growth_score_per_segment: "Очков за сегмент роста",
  min_body_length: "Минимальная длина тела",
  safe_spawn_distance: "Безопасная дистанция спавна",
  min_score: "Минимальный счет для ускорения",
  speed_multiplier: "Множитель скорости",
  drain_interval_seconds: "Интервал потери массы (с)",
  drain_per_interval: "Потеря за интервал",
  food_drop_value: "Номинал сброшенной еды",
  base_radius: "Базовый радиус еды",
  radius_value_scale: "Рост радиуса еды",
  death_drop_score_fraction: "Доля счёта при смерти",
  attraction_radius: "Радиус притяжения еды",
  attraction_speed: "Скорость притяжения еды",
  aoi_radius: "Базовый AoI радиус",
  aoi_length_padding: "AoI бонус за длину",
};

const HIDDEN_FIELDS = new Set(["types"]);

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #3f3f46",
  background: "#18181b",
  color: "#fafafa",
};

const buttonStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #52525b",
  background: "#27272a",
  color: "#fafafa",
  cursor: "pointer",
};

const applyAllStyle: CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  background: "#22c55e",
  color: "#fff",
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: 15,
};

function adminApiUrl() {
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol;
  const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
  const backendPort = isStandardPort ? "" : ":8000";
  return `${protocol}//${host}${backendPort}/admin/config`;
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("snake-admin-password") || "";
  });
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [foodTypes, setFoodTypes] = useState<FoodTypeDraft[]>([]);
  const [status, setStatus] = useState("Введите пароль администратора");

  const apiUrl = useMemo(() => (typeof window === "undefined" ? "" : adminApiUrl()), []);

  const applyLoadedConfig = useCallback((nextConfig: GameConfig) => {
    setConfig(nextConfig);
    const d: Record<string, string> = {};
    for (const [section, values] of Object.entries(nextConfig)) {
      for (const [key, value] of Object.entries(values)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        d[`${section}.${key}`] = String(value);
      }
    }
    setDrafts(d);
    const types = ((nextConfig.food?.types as FoodTypeEntry[] | undefined) || []);
    setFoodTypes(types.map(ft => ({
      value: String(ft.value),
      weight: String(ft.weight),
      color: ft.color,
      expanded: false,
    })));
  }, []);

  const loadConfig = useCallback(async (passwordOverride = password) => {
    setStatus("Загружаю настройки...");
    const response = await fetch(apiUrl, {
      headers: { "x-admin-password": passwordOverride },
    });
    if (!response.ok) {
      setStatus(`Ошибка доступа: ${response.status}`);
      return;
    }
    applyLoadedConfig(await response.json() as GameConfig);
    setStatus("Настройки загружены");
    window.localStorage.setItem("snake-admin-password", passwordOverride);
  }, [apiUrl, password, applyLoadedConfig]);

  const buildPatch = useCallback((): Record<string, unknown> => {
    if (!config) return {};
    const patch: Record<string, Record<string, unknown>> = {};

    for (const [section, values] of Object.entries(config)) {
      for (const [key, value] of Object.entries(values)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        const dk = `${section}.${key}`;
        const draft = drafts[dk];
        if (draft === undefined) continue;
        const original = String(value);
        if (draft !== original) {
          if (!patch[section]) patch[section] = {};
          patch[section][key] = Number(draft);
        }
      }
    }

    // Виды еды
    const origTypes = ((config.food?.types as FoodTypeEntry[] | undefined) || []);
    const newTypes = foodTypes.map(ft => ({
      value: Number(ft.value),
      weight: Number(ft.weight),
      color: ft.color,
    }));
    if (JSON.stringify(newTypes) !== JSON.stringify(origTypes)) {
      if (!patch.food) patch.food = {};
      patch.food.types = newTypes;
    }

    return patch;
  }, [config, drafts, foodTypes]);

  const hasChanges = useMemo(() => Object.keys(buildPatch()).length > 0, [buildPatch]);

  const applyAll = useCallback(async () => {
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setStatus("Нет изменений");
      return;
    }
    setStatus("Применяю изменения...");
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { detail?: string } | null;
      setStatus(error?.detail || `Ошибка сохранения: ${response.status}`);
      return;
    }
    applyLoadedConfig(await response.json() as GameConfig);
    setStatus("✓ Изменения применены в реальном времени");
  }, [apiUrl, password, buildPatch, applyLoadedConfig]);

  const updateFoodType = (index: number, field: string, value: string | boolean) => {
    setFoodTypes(prev => prev.map((ft, i) => i === index ? { ...ft, [field]: value } : ft));
  };

  const removeFoodType = (index: number) => {
    setFoodTypes(prev => prev.filter((_, i) => i !== index));
  };

  const addFoodType = () => {
    setFoodTypes(prev => [...prev, { value: "1", weight: "10", color: "#ffffff", expanded: true }]);
  };

  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", padding: 24, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Админка баланса</h1>
            <p style={{ margin: "6px 0 0", color: "#a1a1aa" }}>{status}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasChanges && (
              <button type="button" onClick={() => void applyAll()} style={applyAllStyle}>
                ✓ Применить все
              </button>
            )}
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, width: 180 }}
            />
            <button type="button" onClick={() => void loadConfig()} style={buttonStyle}>
              Войти / обновить
            </button>
          </div>
        </header>

        {!config && (
          <div style={{ border: "1px solid #27272a", borderRadius: 8, padding: 18, background: "#111113" }}>
            В dev-режиме пароль по умолчанию: <code>admin</code>. В production задайте <code>ADMIN_PASSWORD</code>.
          </div>
        )}

        {config && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            {Object.entries(config).map(([section, values]) => (
              <section key={section} style={{ border: "1px solid #27272a", borderRadius: 8, padding: 16, background: "#111113" }}>
                <h2 style={{ margin: "0 0 14px", fontSize: 18 }}>{SECTION_TITLES[section] || section}</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(values as Record<string, unknown>).map(([key, value]) => {
                    if (HIDDEN_FIELDS.has(key)) return null;
                    const dk = `${section}.${key}`;
                    return (
                      <label key={dk} style={{ display: "grid", gap: 4 }}>
                        <span style={{ color: "#d4d4d8", fontSize: 13 }}>{FIELD_LABELS[key] || key}</span>
                        <input
                          value={drafts[dk] ?? String(value)}
                          onChange={(e) => setDrafts(prev => ({ ...prev, [dk]: e.target.value }))}
                          style={inputStyle}
                        />
                      </label>
                    );
                  })}

                  {section === "food" && (
                    <div style={{ marginTop: 8 }}>
                      <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#d4d4d8" }}>Виды еды</h3>
                      <div style={{ display: "grid", gap: 8 }}>
                        {foodTypes.map((ft, i) => (
                          <div key={i} style={{ border: "1px solid #3f3f46", borderRadius: 6, overflow: "hidden" }}>
                            <div
                              onClick={() => updateFoodType(i, "expanded", !ft.expanded)}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "8px 10px", cursor: "pointer",
                                background: "#1c1c1f", userSelect: "none",
                              }}
                            >
                              <span style={{
                                width: 14, height: 14, borderRadius: "50%",
                                background: ft.color, border: "1px solid #555",
                                flexShrink: 0,
                              }} />
                              <span style={{ flex: 1, fontSize: 13, color: "#e4e4e7" }}>
                                Номинал: {ft.value} · Вес: {ft.weight}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFoodType(i); }}
                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                              >✕</button>
                              <span style={{ color: "#71717a", fontSize: 12 }}>{ft.expanded ? "▲" : "▼"}</span>
                            </div>
                            {ft.expanded && (
                              <div style={{ padding: 10, display: "grid", gap: 8, background: "#18181b" }}>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span style={{ color: "#a1a1aa", fontSize: 12 }}>Номинал</span>
                                  <input value={ft.value} onChange={(e) => updateFoodType(i, "value", e.target.value)} style={inputStyle} />
                                </label>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span style={{ color: "#a1a1aa", fontSize: 12 }}>Вес (шанс спавна)</span>
                                  <input value={ft.weight} onChange={(e) => updateFoodType(i, "weight", e.target.value)} style={inputStyle} />
                                </label>
                                <label style={{ display: "grid", gap: 4 }}>
                                  <span style={{ color: "#a1a1aa", fontSize: 12 }}>Цвет</span>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input
                                      type="color"
                                      value={ft.color}
                                      onChange={(e) => updateFoodType(i, "color", e.target.value)}
                                      style={{ width: 40, height: 34, padding: 2, border: "1px solid #3f3f46", borderRadius: 4, background: "#18181b", cursor: "pointer" }}
                                    />
                                    <input value={ft.color} onChange={(e) => updateFoodType(i, "color", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                                  </div>
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addFoodType}
                          style={{ ...buttonStyle, textAlign: "center" as const, width: "100%" }}
                        >+ Добавить вид еды</button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
