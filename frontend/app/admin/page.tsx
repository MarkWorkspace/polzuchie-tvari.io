"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type FoodTypeEntry = { value: number; weight: number; color: string };
type GameConfig = Record<string, Record<string, unknown>>;
type FoodTypeDraft = { value: string; weight: string; color: string; expanded: boolean };

const NEW_SECTIONS: Record<string, { title: string; icon: string; old_sections: string[] }> = {
  world_network: {
    title: "Мир и Сеть",
    icon: "🌐",
    old_sections: ["world", "network"],
  },
  snake_physics: {
    title: "Змейка и Физика",
    icon: "🐍",
    old_sections: ["snake", "simulation"],
  },
  food_boost: {
    title: "Еда и Бусты",
    icon: "🍎",
    old_sections: ["food", "boost"],
  },
  camera_visual: {
    title: "Камера и Визуал",
    icon: "🎨",
    old_sections: ["visual"],
  },
};

const getNewSectionKey = (oldSec: string): string => {
  if (oldSec === "world" || oldSec === "network") return "world_network";
  if (oldSec === "snake" || oldSec === "simulation") return "snake_physics";
  if (oldSec === "food" || oldSec === "boost") return "food_boost";
  if (oldSec === "visual") return "camera_visual";
  return oldSec;
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
  score_thickness_scale: "Рост толщины от счёта",
  camera_zoom_out_coeff: "Коэф. отдаления камеры за очки",
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
  min_fog_radius: "Минимальный радиус тумана",
  fog_score_expansion_coeff: "Коэф. расширения тумана за очки",
  camera_base_zoom: "Начальное отдаление камеры",
  camera_pitch_angle: "Наклон камеры pitch (°)",
  camera_z_height: "Высота камеры по оси Z",
  camera_y_offset: "Смещение камеры вперед-назад",
  mouse_sensitivity: "Чувствительность мыши",
};

const FIELD_TOOLTIPS: Record<string, string> = {
  target_food_count: "Целевое количество еды, которое сервер будет поддерживать на карте.",
  food_overflow_limit: "Максимальный избыток еды сверх лимита, после которого сервер начнет удалять лишнюю еду.",
  cluster_spawn_chance: "Шанс (от 0 до 1) спавна новой еды в одном из плотных кластеров, а не случайно.",
  cluster_move_chance: "Шанс смещения центра кластера на каждом тике для динамики зон питания.",
  tick_rate: "Частота обновлений (тиков) игрового мира в секунду на сервере.",
  turn_radius_thickness_coeff: "Коэффициент увеличения радиуса разворота в зависимости от толщины змейки.",
  turn_idle_smoothing_at_20hz: "Плавность возврата к прямолинейному движению при отпускании кнопок поворота.",
  turn_active_smoothing_at_20hz: "Плавность входа в поворот при нажатии кнопок направления.",
  score_thickness_scale: "Коэффициент масштабирования толщины тела и радиуса головы змейки от счёта.",
  camera_zoom_out_coeff: "Степень отдаления камеры по мере увеличения счёта игрока.",
  drain_interval_seconds: "Интервал времени в секундах, за который при ускорении списывается масса.",
  food_drop_value: "Номинал капелек еды, сбрасываемых позади змейки при ускорении.",
  attraction_radius: "Радиус притяжения (магнетизма), в пределах которого еда летит к змейке.",
  attraction_speed: "Скорость притяжения еды к голове змейки.",
  aoi_radius: "Базовый радиус Area of Interest (видимости) игрока в ячейках.",
  aoi_length_padding: "Коэффициент расширения радиуса Area of Interest от длины змейки.",
  min_fog_radius: "Минимальный радиус визуального тумана войны вокруг головы змейки.",
  fog_score_expansion_coeff: "Коэффициент расширения тумана войны по мере увеличения счёта.",
  mouse_sensitivity: "Коэффициент отклонения курсора от центра экрана для достижения максимальной скорости разворота змейки (1.0 — четверть экрана, 2.0 — половина экрана до края)."
};

const FIELD_UNITS: Record<string, string> = {
  width: "ячеек",
  height: "ячеек",
  target_food_count: "шт.",
  food_overflow_limit: "шт.",
  cluster_count: "шт.",
  cluster_spawn_chance: "доля",
  cluster_spread: "ячеек",
  cluster_move_chance: "/ тик",
  tick_rate: "Гц",
  base_speed_per_second: "яч./с",
  max_turn_speed_deg_per_second: "°/с",
  min_turn_radius: "ячеек",
  turn_radius_thickness_coeff: "коэф.",
  turn_idle_smoothing_at_20hz: "коэф.",
  turn_active_smoothing_at_20hz: "коэф.",
  start_length: "сегм.",
  start_score: "очков",
  base_head_radius: "ячеек",
  score_thickness_scale: "коэф.",
  camera_zoom_out_coeff: "коэф.",
  growth_score_per_segment: "оч./сегм",
  min_body_length: "сегм.",
  safe_spawn_distance: "ячеек",
  min_score: "очков",
  speed_multiplier: "x",
  drain_interval_seconds: "сек.",
  drain_per_interval: "очков",
  food_drop_value: "очков",
  base_radius: "ячеек",
  radius_value_scale: "коэф.",
  death_drop_score_fraction: "доля",
  attraction_radius: "ячеек",
  attraction_speed: "яч./с",
  aoi_radius: "ячеек",
  aoi_length_padding: "коэф.",
  min_fog_radius: "ячеек",
  fog_score_expansion_coeff: "коэф.",
  camera_base_zoom: "коэф.",
  camera_pitch_angle: "°",
  camera_z_height: "ячеек",
  camera_y_offset: "ячеек",
  mouse_sensitivity: "коэф."
};

const HIDDEN_FIELDS = new Set(["types"]);

function adminApiUrl() {
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol;
  const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
  
  if (isStandardPort) {
    return `${protocol}//${host}/ws/admin/config`;
  }
  return `${protocol}//${host}:8000/admin/config`;
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("snake-admin-password") || "";
  });
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [foodTypes, setFoodTypes] = useState<FoodTypeDraft[]>([]);
  const [status, setStatus] = useState("Введите пароль администратора для авторизации");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [healthData, setHealthData] = useState<{ online: boolean; players: number; ping: number | null }>({
    online: false,
    players: 0,
    ping: null,
  });

  useEffect(() => {
    let active = true;
    const fetchHealth = async () => {
      const start = performance.now();
      try {
        const host = window.location.hostname || "127.0.0.1";
        const protocol = window.location.protocol;
        const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
        const healthUrl = isStandardPort
          ? `${protocol}//${host}/ws/health`
          : `${protocol}//${host}:8000/health`;

        const res = await fetch(healthUrl);
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        const duration = performance.now() - start;
        if (active) {
          setHealthData({
            online: true,
            players: data.players || 0,
            ping: Math.round(duration),
          });
        }
      } catch (err) {
        if (active) {
          setHealthData({
            online: false,
            players: 0,
            ping: null,
          });
        }
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
    setStatus("Загрузка текущих параметров баланса...");
    try {
      const response = await fetch(apiUrl, {
        headers: { "x-admin-password": passwordOverride },
      });
      if (!response.ok) {
        setStatus(`Ошибка доступа: Неверный пароль (${response.status})`);
        return;
      }
      applyLoadedConfig(await response.json() as GameConfig);
      setStatus("Параметры успешно загружены с сервера");
      window.localStorage.setItem("snake-admin-password", passwordOverride);
    } catch (e) {
      setStatus(`Не удалось подключиться к серверу: ${String(e)}`);
    }
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
      setStatus("Изменения отсутствуют");
      return;
    }
    setStatus("Применение новых параметров...");
    try {
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
        setStatus(error?.detail || `Ошибка при сохранении: ${response.status}`);
        return;
      }
      applyLoadedConfig(await response.json() as GameConfig);
      setStatus("✓ Конфигурация успешно обновлена в реальном времени!");
    } catch (e) {
      setStatus(`Ошибка сети при отправке патча: ${String(e)}`);
    }
  }, [apiUrl, password, buildPatch, applyLoadedConfig]);

  const resetAllDrafts = useCallback(() => {
    if (!config) return;
    const d: Record<string, string> = {};
    for (const [section, values] of Object.entries(config)) {
      for (const [key, value] of Object.entries(values)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        d[`${section}.${key}`] = String(value);
      }
    }
    setDrafts(d);
    const types = ((config.food?.types as FoodTypeEntry[] | undefined) || []);
    setFoodTypes(types.map(ft => ({
      value: String(ft.value),
      weight: String(ft.weight),
      color: ft.color,
      expanded: false,
    })));
    setStatus("Все локальные изменения сброшены к серверным");
  }, [config]);

  const resetSingleField = useCallback((dk: string, originalValue: unknown) => {
    setDrafts(prev => ({ ...prev, [dk]: String(originalValue) }));
  }, []);

  const updateFoodType = (index: number, field: string, value: string | boolean) => {
    setFoodTypes(prev => prev.map((ft, i) => i === index ? { ...ft, [field]: value } : ft));
  };

  const removeFoodType = (index: number) => {
    setFoodTypes(prev => prev.filter((_, i) => i !== index));
  };

  const addFoodType = () => {
    setFoodTypes(prev => [...prev, { value: "1", weight: "10", color: "#ffffff", expanded: true }]);
  };

  // Вычисление измененных полей для вкладок
  const sectionModifiedCounts = useMemo(() => {
    const counts: Record<string, number> = {
      world_network: 0,
      snake_physics: 0,
      food_boost: 0,
      camera_visual: 0,
      all: 0,
    };
    if (!config) return counts;
    
    let total = 0;
    for (const [section, values] of Object.entries(config)) {
      let count = 0;
      for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        const dk = `${section}.${key}`;
        if (drafts[dk] !== undefined && drafts[dk] !== String(value)) {
          count++;
          total++;
        }
      }
      
      const newSec = getNewSectionKey(section);
      if (counts[newSec] !== undefined) {
        counts[newSec] += count;
      }
    }
    
    // Еда: Проверяем виды еды отдельно (входит в food_boost)
    const origTypes = ((config.food?.types as FoodTypeEntry[] | undefined) || []);
    const newTypes = foodTypes.map(ft => ({
      value: Number(ft.value),
      weight: Number(ft.weight),
      color: ft.color,
    }));
    if (JSON.stringify(newTypes) !== JSON.stringify(origTypes)) {
      counts.food_boost += 1;
      total++;
    }
    
    counts.all = total;
    return counts;
  }, [config, drafts, foodTypes]);

  // Фильтрация настроек по поисковому запросу
  const allFields = useMemo(() => {
    if (!config) return [];
    const list: { section: string; key: string; value: unknown; label: string; dk: string }[] = [];
    for (const [section, values] of Object.entries(config)) {
      for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
        if (HIDDEN_FIELDS.has(key)) continue;
        const label = FIELD_LABELS[key] || key;
        list.push({ section, key, value, label, dk: `${section}.${key}` });
      }
    }
    return list;
  }, [config]);

  const filteredFields = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return allFields;
    return allFields.filter(f => 
      f.label.toLowerCase().includes(query) ||
      f.key.toLowerCase().includes(query) ||
      NEW_SECTIONS[getNewSectionKey(f.section)]?.title.toLowerCase().includes(query)
    );
  }, [allFields, searchQuery]);

  const activeTabFields = useMemo(() => {
    if (activeTab === "all") return filteredFields;
    const allowedOldSections = NEW_SECTIONS[activeTab]?.old_sections || [];
    return filteredFields.filter(f => allowedOldSections.includes(f.section));
  }, [filteredFields, activeTab]);

  // Группировка отфильтрованных полей по категориям
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof activeTabFields> = {};
    for (const f of activeTabFields) {
      const newSec = getNewSectionKey(f.section);
      if (!groups[newSec]) groups[newSec] = [];
      groups[newSec].push(f);
    }
    return groups;
  }, [activeTabFields]);

  return (
    <main style={{ 
      minHeight: "100vh", 
      background: "#2b2d34", 
      color: "#fafafa", 
      padding: "0 24px 48px", 
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" 
    }}>
      <style>{`
        @keyframes pulse-crimson {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.95); }
        }
        @keyframes slide-up-fade {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .floating-action-panel {
          animation: slide-up-fade 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .pulse-dot {
          animation: pulse-crimson 2s infinite ease-in-out;
        }
        .admin-tab {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #3f414a !important;
          background: #30323a;
          color: #a1a1aa;
        }
        .admin-tab:hover {
          background: #3f414a !important;
          color: #ffffff !important;
          border-color: #52545d !important;
        }
        .admin-tab.active {
          background: #e63946 !important;
          color: #ffffff !important;
          border-color: #e63946 !important;
          box-shadow: 0 4px 12px rgba(230, 57, 70, 0.2);
        }
        .admin-input {
          transition: all 0.15s ease-in-out;
        }
        .admin-input:focus {
          border-color: #e63946 !important;
          box-shadow: 0 0 0 2px rgba(230, 57, 70, 0.15);
          outline: none;
        }
        .setting-card {
          transition: all 0.2s ease-in-out;
          border: 1px solid #3f414a;
          background: #30323a;
        }
        .setting-card:hover {
          border-color: #52545d;
          background: #383a43;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }
        .setting-card.modified {
          border-color: #f59e0b !important;
          background: #452a0a;
        }
        .btn-action {
          transition: all 0.2s ease-in-out;
          cursor: pointer;
        }
        .btn-action:hover {
          transform: translateY(-1px);
          filter: brightness(1.15);
        }
        .btn-action:active {
          transform: translateY(0);
        }
        .food-card {
          transition: all 0.2s ease-in-out;
          border: 1px solid #3f414a;
          background: #30323a;
        }
        .food-card:hover {
          border-color: #52545d;
          background: #383a43;
        }
        .standard-panel {
          background: #30323a;
          border: 1px solid #3f414a;
        }
        .tooltip-container:hover .tooltip-text {
          visibility: visible !important;
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .tooltip-container:hover .tooltip-icon {
          background: #e63946 !important;
          color: #ffffff !important;
        }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ 
          display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", 
          marginBottom: 32, flexWrap: "wrap", 
          position: "sticky", top: 0, zIndex: 100, 
          background: "#2b2d34", 
          padding: "28px 0 16px", borderBottom: "1px solid #3f414a" 
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>🛠️</span>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", background: "linear-gradient(to right, #fafafa, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Snake AI · Консоль Баланса
                </h1>
              </div>

              {/* Sleek status summary */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                background: "rgba(48, 50, 58, 0.85)",
                border: "1px solid rgba(63, 65, 74, 0.6)",
                padding: "6px 16px",
                borderRadius: "30px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                backdropFilter: "blur(4px)",
                color: "#fafafa"
              }}>
                {/* Server status */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: healthData.online ? "#4ade80" : "#f87171",
                    boxShadow: healthData.online ? "0 0 8px #4ade80" : "0 0 8px #f87171",
                    display: "inline-block"
                  }} />
                  <span>
                    Server: <span style={{ color: healthData.online ? "#4ade80" : "#f87171" }}>
                      {healthData.online ? "online" : "offline"}
                    </span>
                  </span>
                </div>

                <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>

                {/* Active players count */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#a1a1aa" }}>Players:</span>
                  <span style={{ color: "#fafafa" }}>{healthData.players}</span>
                </div>

                {healthData.online && healthData.ping !== null && (
                  <>
                    <span style={{ color: "rgba(255,255,255,0.15)" }}>|</span>

                    {/* Ping */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ color: "#a1a1aa" }}>Ping:</span>
                      <span style={{
                        color: healthData.ping <= 75 ? "#4ade80" : healthData.ping <= 150 ? "#fbbf24" : "#f87171"
                      }}>
                        {healthData.ping} ms
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p style={{ margin: "6px 0 0", color: "#a1a1aa", fontSize: 14, fontWeight: 500 }}>
              {status}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            
            <div style={{ position: "relative", display: "flex", gap: 6, background: "#30323a", padding: 4, borderRadius: 10, border: "1px solid #3f414a" }}>
              <input
                type="password"
                placeholder="Пароль администратора"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ 
                  background: "transparent", 
                  border: "none", 
                  color: "#fafafa", 
                  padding: "6px 12px", 
                  fontSize: 13, 
                  width: 170,
                  outline: "none"
                }}
              />
              <button 
                type="button" 
                onClick={() => void loadConfig()} 
                className="btn-action"
                style={{ 
                  padding: "6px 14px", borderRadius: 7, border: "none",
                  background: "#3f414a", color: "#fafafa", fontWeight: 600, fontSize: 13 
                }}
              >
                Войти
              </button>
            </div>
          </div>
        </header>

        {!config ? (
          <div style={{ 
            maxWidth: 550, margin: "80px auto 0", 
            borderRadius: 16, padding: "32px 40px", 
            textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" 
          }} className="standard-panel">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>Требуется авторизация</h2>
            <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: "1.6", margin: "0 0 24px" }}>
              Для управления балансом игры, спавном еды, физикой движения змеек и визуалом введите пароль администратора.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                style={{ 
                  padding: "12px 16px", borderRadius: 8, border: "1px solid #3f414a",
                  background: "#2b2d34", color: "#fafafa", width: 220, fontSize: 14 
                }}
              />
              <button 
                type="button" 
                onClick={() => void loadConfig()} 
                className="btn-action"
                style={{ 
                  padding: "12px 24px", borderRadius: 8, border: "none",
                  background: "#e63946", color: "#fff", fontWeight: 700, fontSize: 14,
                  boxShadow: "0 4px 12px rgba(230, 57, 70, 0.2)"
                }}
              >
                Подключиться
              </button>
            </div>
            <p style={{ margin: "24px 0 0", color: "#a1a1aa", fontSize: 12 }}>
              В режиме разработки (dev) пароль по умолчанию: <code>admin</code>
            </p>
          </div>
        ) : (
          <div>
            {/* ТАБЫ & ПОИСК */}
            <div style={{ 
              display: "flex", justifyContent: "space-between", alignItems: "center", 
              gap: 16, marginBottom: 28, flexWrap: "wrap" 
            }}>
              {/* Вкладки */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`admin-tab ${activeTab === "all" ? "active" : ""}`}
                  style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer" }}
                >
                  🗂️ Все настройки
                  {sectionModifiedCounts.all > 0 && (
                    <span style={{ background: activeTab === "all" ? "#fff" : "#f59e0b", color: activeTab === "all" ? "#e63946" : "#2b2d34", padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      +{sectionModifiedCounts.all}
                    </span>
                  )}
                </button>
                {Object.entries(NEW_SECTIONS).map(([secKey, secInfo]) => {
                  const hasSectionChanges = sectionModifiedCounts[secKey] > 0;
                  return (
                    <button
                      key={secKey}
                      type="button"
                      onClick={() => setActiveTab(secKey)}
                      className={`admin-tab ${activeTab === secKey ? "active" : ""}`}
                      style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer" }}
                    >
                      <span>{secInfo.icon}</span>
                      {secInfo.title}
                      {hasSectionChanges && (
                        <span style={{ 
                          background: activeTab === secKey ? "#fff" : "#f59e0b", 
                          color: activeTab === secKey ? "#e63946" : "#2b2d34", 
                          padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 
                        }}>
                          +{sectionModifiedCounts[secKey]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Поиск */}
              <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
                <input
                  type="text"
                  placeholder="🔎 Быстрый поиск настройки..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-input"
                  style={{
                    width: "100%", padding: "10px 14px 10px 32px", borderRadius: 8,
                    border: "1px solid #3f414a", background: "#30323a", color: "#fafafa",
                    fontSize: 13
                  }}
                />
                {searchQuery && (
                  <span 
                    onClick={() => setSearchQuery("")}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#a1a1aa", fontSize: 14 }}
                  >
                    ✕
                  </span>
                )}
              </div>
            </div>

            {/* ОСНОВНОЙ КОНТЕНТ */}
            {activeTabFields.length === 0 && searchQuery ? (
              <div style={{ border: "1px solid #3f414a", borderRadius: 12, padding: "40px 20px", textAlign: "center", background: "#30323a", color: "#a1a1aa" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                Ничего не найдено по запросу «{searchQuery}» в текущем разделе.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%" }}>
                
                {/* Рендеринг отфильтрованных параметров последовательными подписанными блоками */}
                {Object.entries(NEW_SECTIONS).map(([secKey, secInfo]) => {
                  const fieldsInSec = groupedFields[secKey] || [];
                  if (fieldsInSec.length === 0) return null;

                  return (
                    <div key={secKey} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      
                      {/* Подписанный блок-заголовок категории */}
                      {(activeTab === "all" || searchQuery) && (
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 10, 
                          borderBottom: "2px solid #3f414a", 
                          paddingBottom: 8,
                          marginTop: 8
                        }}>
                          <span style={{ fontSize: 20 }}>{secInfo.icon}</span>
                          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fafafa", letterSpacing: "-0.01em" }}>
                            {secInfo.title}
                          </h3>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
                        {fieldsInSec.map((f) => {
                          const draftVal = drafts[f.dk] ?? String(f.value);
                          const isFieldModified = draftVal !== String(f.value);

                          return (
                            <div 
                              key={f.dk} 
                              className={`setting-card ${isFieldModified ? "modified" : ""}`}
                              style={{ 
                                borderRadius: 10, 
                                padding: 16, 
                                display: "flex", 
                                flexDirection: "column",
                                justifyContent: "space-between",
                                position: "relative"
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: "#fafafa", fontSize: 14, fontWeight: 600 }}>{f.label}</span>
                                    {FIELD_TOOLTIPS[f.key] && (
                                      <div className="tooltip-container" style={{ position: "relative", display: "inline-block", cursor: "help" }}>
                                        <span style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          width: 16,
                                          height: 16,
                                          borderRadius: "50%",
                                          background: "#3f414a",
                                          color: "#a1a1aa",
                                          fontSize: 10,
                                          fontWeight: 800,
                                          transition: "all 0.15s ease"
                                        }} className="tooltip-icon">
                                          ?
                                        </span>
                                        <div className="tooltip-text" style={{
                                          visibility: "hidden",
                                          width: 240,
                                          backgroundColor: "#1e2025",
                                          color: "#fafafa",
                                          textAlign: "left",
                                          borderRadius: 8,
                                          padding: "8px 12px",
                                          position: "absolute",
                                          zIndex: 10,
                                          bottom: "125%",
                                          left: "50%",
                                          marginLeft: -120,
                                          opacity: 0,
                                          transition: "opacity 0.2s ease, transform 0.2s ease",
                                          transform: "translateY(4px)",
                                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                                          fontSize: 11,
                                          lineHeight: "1.4",
                                          pointerEvents: "none",
                                          border: "1px solid #3f414a"
                                        }}>
                                          {FIELD_TOOLTIPS[f.key]}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {isFieldModified && (
                                    <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, background: "rgba(245, 158, 11, 0.15)", padding: "2px 6px", borderRadius: 10 }}>
                                      изменено
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontFamily: "monospace", fontSize: 10, color: "#a1a1aa", wordBreak: "break-all", marginBottom: 12 }}>
                                  {f.dk}
                                </div>
                              </div>

                              <div>
                                {isFieldModified && (
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#a1a1aa", marginBottom: 6, padding: "0 2px" }}>
                                    <span>Было: <strong style={{ color: "#8a8b94" }}>{String(f.value)}</strong></span>
                                    <button 
                                      type="button" 
                                      onClick={() => resetSingleField(f.dk, f.value)}
                                      style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}
                                    >
                                      Сбросить ↺
                                    </button>
                                  </div>
                                )}

                                <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                  <input
                                    value={draftVal}
                                    onChange={(e) => setDrafts(prev => ({ ...prev, [f.dk]: e.target.value }))}
                                    className="admin-input"
                                    style={{
                                      flex: 1,
                                      width: "100%",
                                      padding: "10px 12px",
                                      borderRadius: 8,
                                      border: `1px solid ${isFieldModified ? "#d97706" : "#3f414a"}`,
                                      background: "#2b2d34",
                                      color: "#fafafa",
                                      fontSize: 14,
                                      fontWeight: 600
                                    }}
                                  />
                                  {FIELD_UNITS[f.key] && (
                                    <span style={{
                                      color: "#a1a1aa",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background: "#24262c",
                                      border: "1px solid #3f414a",
                                      padding: "10px 12px",
                                      borderRadius: 8,
                                      whiteSpace: "nowrap",
                                      minWidth: "60px",
                                      textAlign: "center"
                                    }}>
                                      {FIELD_UNITS[f.key]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Особая секция "Виды еды" в табе "Еда и Бусты" или табе "Все" */}
                      {secKey === "food_boost" && (activeTab === "food_boost" || activeTab === "all") && !searchQuery && (
                        <div style={{ 
                          marginTop: 12, 
                          border: "1px solid #3f414a", 
                          borderRadius: 12, 
                          padding: 20, 
                          background: "#30323a" 
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🍎 Настройка видов и спавна еды</h3>
                              <p style={{ margin: "4px 0 0", color: "#a1a1aa", fontSize: 13 }}>
                                Различные типы яблок, их вес (шанс появления) и цветовое оформление на карте.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={addFoodType}
                              className="btn-action"
                              style={{ 
                                padding: "8px 16px", borderRadius: 8, border: "1px solid #e63946",
                                background: "rgba(230, 57, 70, 0.1)", color: "#e63946", fontWeight: 600, fontSize: 13 
                              }}
                            >
                              + Добавить новый вид еды
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                            {foodTypes.map((ft, i) => (
                              <div key={i} className="food-card" style={{ borderRadius: 10, overflow: "hidden" }}>
                                <div
                                  onClick={() => updateFoodType(i, "expanded", !ft.expanded)}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "12px 14px", cursor: "pointer",
                                    background: "#383a43", userSelect: "none"
                                  }}
                                >
                                  <span style={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    background: ft.color, border: "2px solid rgba(255,255,255,0.2)",
                                    boxShadow: `0 0 10px ${ft.color}40`,
                                    flexShrink: 0
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}>
                                      Номинал: {ft.value} очков
                                    </div>
                                    <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>
                                      Вес в пуле спавна: {ft.weight}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); removeFoodType(i); }}
                                    style={{ 
                                      background: "none", border: "none", color: "#e63946", 
                                      cursor: "pointer", fontSize: 18, padding: "0 6px" 
                                    }}
                                  >
                                    ✕
                                  </button>
                                  <span style={{ color: "#a1a1aa", fontSize: 10 }}>{ft.expanded ? "▲" : "▼"}</span>
                                </div>

                                {ft.expanded && (
                                  <div style={{ padding: 14, display: "grid", gap: 10, background: "#30323a", borderTop: "1px solid #3f414a" }}>
                                    <label style={{ display: "grid", gap: 4 }}>
                                      <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Очки (Номинал)</span>
                                      <input value={ft.value} onChange={(e) => updateFoodType(i, "value", e.target.value)} className="admin-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #3f414a", background: "#2b2d34", color: "#fafafa", fontSize: 13 }} />
                                    </label>
                                    
                                    <label style={{ display: "grid", gap: 4 }}>
                                      <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Вес (Шанс спавна)</span>
                                      <input value={ft.weight} onChange={(e) => updateFoodType(i, "weight", e.target.value)} className="admin-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #3f414a", background: "#2b2d34", color: "#fafafa", fontSize: 13 }} />
                                    </label>

                                    <label style={{ display: "grid", gap: 4 }}>
                                      <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Цветовой тон</span>
                                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <input
                                          type="color"
                                          value={ft.color}
                                          onChange={(e) => updateFoodType(i, "color", e.target.value)}
                                          style={{ 
                                            width: 42, height: 34, padding: 2, 
                                            border: "1px solid #3f414a", borderRadius: 6, 
                                            background: "#2b2d34", cursor: "pointer" 
                                          }}
                                        />
                                        <input 
                                          value={ft.color} 
                                          onChange={(e) => updateFoodType(i, "color", e.target.value)} 
                                          className="admin-input" 
                                          style={{ 
                                            flex: 1, padding: "8px 10px", borderRadius: 6, 
                                            border: "1px solid #3f414a", background: "#2b2d34", 
                                            color: "#fafafa", fontSize: 13, fontFamily: "monospace" 
                                          }} 
                                        />
                                      </div>
                                    </label>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}

              </div>
            )}

            {/* Floating Action Panel in Bottom-Right Corner */}
            {hasChanges && (
              <div 
                className="floating-action-panel"
                style={{
                  position: "fixed",
                  bottom: 24,
                  right: 24,
                  zIndex: 1000,
                  background: "rgba(48, 50, 58, 0.95)",
                  border: "1px solid #f59e0b",
                  borderRadius: 16,
                  padding: "16px 20px",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(245, 158, 11, 0.15)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxWidth: 320,
                  color: "#fafafa",
                  pointerEvents: "auto"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Несохраненные изменения!</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: "1.4" }}>
                  Вы изменили параметры баланса. Примените их, чтобы обновить игровой мир в реальном времени.
                </p>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button 
                    type="button" 
                    onClick={resetAllDrafts} 
                    className="btn-action"
                    style={{ 
                      flex: 1,
                      padding: "10px 14px", borderRadius: 8, border: "1px solid #f59e0b",
                      background: "transparent", color: "#f59e0b", fontWeight: 600, fontSize: 13 
                    }}
                  >
                    Сбросить
                  </button>
                  <button 
                    type="button" 
                    onClick={() => void applyAll()} 
                    className="btn-action"
                    style={{ 
                      flex: 1.3,
                      padding: "10px 16px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg, #e63946, #c92a3a)", color: "#fff", 
                      fontWeight: 700, fontSize: 13, boxShadow: "0 4px 14px rgba(230, 57, 70, 0.3)" 
                    }}
                  >
                    Применить ({sectionModifiedCounts.all})
                  </button>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
