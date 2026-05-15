"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";

type ConfigPrimitive = number | number[];
type ConfigSection = Record<string, ConfigPrimitive>;
type GameConfig = Record<string, ConfigSection>;

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
  turn_speed_per_second: "Скорость поворота",
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
  drain_interval_seconds: "Интервал потери массы",
  score_drain: "Потеря очков за интервал",
  growth_drain: "Потеря роста за интервал",
  food_drop_value: "Номинал сброшенной еды",
  values: "Номиналы еды",
  weights: "Веса еды",
  base_radius: "Базовый радиус еды",
  radius_value_scale: "Рост радиуса еды",
  death_drop_score_fraction: "Доля счета при смерти",
  aoi_radius: "Базовый AoI радиус",
  aoi_length_padding: "AoI бонус за длину",
};

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

function adminApiUrl() {
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol;
  const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
  const backendPort = isStandardPort ? "" : ":8000";
  return `${protocol}//${host}${backendPort}/admin/config`;
}

function formatValue(value: ConfigPrimitive) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function parseValue(rawValue: string, currentValue: ConfigPrimitive) {
  if (Array.isArray(currentValue)) {
    return rawValue
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }
  return Number(rawValue);
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("snake-admin-password") || "";
  });
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Введите пароль администратора");

  const apiUrl = useMemo(() => (typeof window === "undefined" ? "" : adminApiUrl()), []);

  const loadConfig = useCallback(async (passwordOverride = password) => {
    setStatus("Загружаю настройки...");
    const response = await fetch(apiUrl, {
      headers: { "x-admin-password": passwordOverride },
    });
    if (!response.ok) {
      setStatus(`Ошибка доступа: ${response.status}`);
      return;
    }
    const nextConfig = (await response.json()) as GameConfig;
    setConfig(nextConfig);
    setDrafts(flattenDrafts(nextConfig));
    setStatus("Настройки загружены");
    window.localStorage.setItem("snake-admin-password", passwordOverride);
  }, [apiUrl, password]);

  const applyField = async (section: string, key: string, currentValue: ConfigPrimitive) => {
    const draftKey = `${section}.${key}`;
    const nextValue = parseValue(drafts[draftKey] ?? "", currentValue);
    setStatus(`Применяю ${FIELD_LABELS[key] || key}...`);
    const response = await fetch(apiUrl, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ [section]: { [key]: nextValue } }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { detail?: string } | null;
      setStatus(error?.detail || `Ошибка сохранения: ${response.status}`);
      return;
    }
    const nextConfig = (await response.json()) as GameConfig;
    setConfig(nextConfig);
    setDrafts(flattenDrafts(nextConfig));
    setStatus("Применено в реальном времени");
  };

  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", padding: 24, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Админка баланса</h1>
            <p style={{ margin: "6px 0 0", color: "#a1a1aa" }}>{status}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
                  {Object.entries(values).map(([key, value]) => {
                    const draftKey = `${section}.${key}`;
                    return (
                      <label key={draftKey} style={{ display: "grid", gap: 6 }}>
                        <span style={{ color: "#d4d4d8", fontSize: 13 }}>{FIELD_LABELS[key] || key}</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                          <input
                            value={drafts[draftKey] ?? formatValue(value)}
                            onChange={(event) => setDrafts((current) => ({ ...current, [draftKey]: event.target.value }))}
                            style={inputStyle}
                          />
                          <button type="button" onClick={() => void applyField(section, key, value)} style={buttonStyle}>
                            Применить
                          </button>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function flattenDrafts(config: GameConfig) {
  const drafts: Record<string, string> = {};
  for (const [section, values] of Object.entries(config)) {
    for (const [key, value] of Object.entries(values)) {
      drafts[`${section}.${key}`] = formatValue(value);
    }
  }
  return drafts;
}
