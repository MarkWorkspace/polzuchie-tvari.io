"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

type FoodTypeEntry = { value: number; weight: number; color: string };
type GameConfig = Record<string, Record<string, unknown>>;
type FoodTypeDraft = { value: string; weight: string; color: string; expanded: boolean };

const NEW_SECTIONS: Record<string, { title: string; icon: string; old_sections: string[] }> = {
  world_network: {
    title: "World & Network",
    icon: "🌐",
    old_sections: ["world", "network"],
  },
  snake_physics: {
    title: "Snake & Physics",
    icon: "🐍",
    old_sections: ["snake", "simulation"],
  },
  food_boost: {
    title: "Food & Boost",
    icon: "🍎",
    old_sections: ["food", "boost"],
  },
  camera_visual: {
    title: "Camera & Visual",
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
  width: "Map Width",
  height: "Map Height",
  target_food_count: "Target Food Count",
  food_overflow_limit: "Food Overflow Limit",
  cluster_count: "Cluster Count",
  cluster_spawn_chance: "Cluster Spawn Chance",
  cluster_spread: "Cluster Spread",
  cluster_move_chance: "Cluster Move Chance (once/min)",
  tick_rate: "Server Tick Rate",
  base_speed_per_second: "Snake Base Speed",
  max_turn_speed_deg_per_second: "Max Turn Speed (°/s)",
  min_turn_radius: "Min Turn Radius",
  turn_radius_thickness_coeff: "Turn Radius Thickness Coeff",
  turn_idle_smoothing_at_20hz: "Idle Alignment Smoothing",
  turn_active_smoothing_at_20hz: "Active Turn Smoothing",
  start_length: "Start Length",
  start_score: "Start Score",
  base_head_radius: "Min Head Radius",
  score_thickness_scale: "Thickness Growth per Score",
  camera_zoom_out_coeff: "Camera Zoom-Out Coeff",
  growth_score_per_segment: "Score per Growth Segment (Number or Formula)",
  min_body_length: "Min Body Length",
  safe_spawn_distance: "Safe Spawn Distance",
  max_growth_score: "Snake Max Growth Cap",
  min_score: "Min Boost Score",
  speed_multiplier: "Speed Multiplier",
  drain_interval_seconds: "Mass Drain Interval (s)",
  drain_per_interval: "Mass Drain per Interval",
  food_drop_value: "Dropped Food Value",
  base_radius: "Base Food Radius",
  radius_value_scale: "Food Radius Scale",
  death_drop_score_fraction: "Death Drop Score Fraction",
  attraction_radius: "Food Attraction Radius",
  attraction_speed: "Food Attraction Speed",
  aoi_radius: "Base AoI Radius",
  aoi_length_padding: "AoI Length Bonus",
  min_fog_radius: "Min Fog Radius",
  fog_score_expansion_coeff: "Fog Expansion Coeff",
  camera_base_zoom: "Camera Base Zoom",
  camera_pitch_angle: "Camera Pitch Angle (°)",
  camera_z_height: "Camera Z-Height",
  camera_y_offset: "Camera Y-Offset",
  mouse_sensitivity: "Mouse Sensitivity",
  portals_enabled: "Portals Enabled",
  portals_count: "Portal Pairs Count",
  portals_radius: "Portal Radius",
  black_holes_enabled: "Black Holes Enabled",
  black_holes_count: "Black Holes Count",
  black_holes_spawn_chance: "Black Hole Spawn Chance",
  black_holes_pull_radius: "Gravity Pull Radius",
  black_holes_pull_force: "Gravity Pull Force",
  black_holes_kill_radius: "Event Horizon Radius",
  black_holes_growth_time: "Black Hole Growth/Shrink Time",
};

const FIELD_TOOLTIPS: Record<string, string> = {
  target_food_count: "Target food count that the server maintains on the map.",
  food_overflow_limit: "Maximum extra food above target, after which the server trims excess food.",
  cluster_spawn_chance: "Chance (0 to 1) of spawning new food inside a dense cluster rather than randomly.",
  cluster_move_chance: "Chance of shifting a food cluster center, checked by the server once every minute.",
  tick_rate: "Frequency of game world updates (ticks per second) on the server.",
  turn_radius_thickness_coeff: "Coefficient for increasing the turn radius based on the snake's thickness.",
  turn_idle_smoothing_at_20hz: "Smoothness of return to straight motion when turning keys are released.",
  turn_active_smoothing_at_20hz: "Smoothness of entering a turn when turning keys are pressed.",
  score_thickness_scale: "Coefficient for scaling body thickness and head radius relative to score.",
  camera_zoom_out_coeff: "Camera zoom-out scaling factor as the player's length increases. Normal values are between 0.1 and 100.0 (default is 200.0).",
  growth_score_per_segment: "Required score to grow a segment. Can be a number (e.g. 10) or safe math expression using variable s (score) or l (length), e.g. '10 + l * 0.5' or '10 + log(s) * 5'. Evaluated securely on the server.",
  max_growth_score: "Score limit above which the snake stops growing new body segments (length) but continues to gain score.",
  drain_interval_seconds: "Time interval in seconds at which score is drained during acceleration.",
  food_drop_value: "Value of food particles dropped behind the snake during acceleration.",
  attraction_radius: "Attraction (magnetism) radius within which food flies towards the snake.",
  attraction_speed: "Speed of food attraction towards the snake's head.",
  aoi_radius: "Base Area of Interest (visibility) radius of the player in cells.",
  aoi_length_padding: "Length-based Area of Interest expansion coefficient.",
  min_fog_radius: "Minimum visual fog-of-war radius around the snake's head.",
  fog_score_expansion_coeff: "Fog-of-war expansion coefficient relative to score.",
  mouse_sensitivity: "Cursor deflection factor from the center of the screen to reach maximum snake turning speed (1.0 - quarter screen, 2.0 - half screen to the edge).",
  portals_enabled: "Enable or disable spatial teleportation portal pairs on the map (1 = enabled, 0 = disabled).",
  portals_count: "Number of active portal pairs. Entrance and exit coordinates are generated randomly.",
  portals_radius: "Radius of the portal area in grid units. Heads entering this area are teleported to the sister portal.",
  black_holes_enabled: "Enable or disable gravity-well black holes that attract players and food (1 = enabled, 0 = disabled).",
  black_holes_count: "Number of active black hole slots on the map.",
  black_holes_spawn_chance: "Probability (0 to 1) checked once per minute for each slot to determine if a black hole should grow at a random location.",
  black_holes_pull_radius: "Drift/gravity field range. Entities inside this range are pulled towards the center.",
  black_holes_pull_force: "Gravity pull strength factor in grid units per second.",
  black_holes_kill_radius: "Event horizon range. Heads touching this zone are instantly destroyed. Food is consumed.",
  black_holes_growth_time: "Duration in seconds for a black hole to smoothly grow or collapse between zero and its full size."
};

const FIELD_UNITS: Record<string, string> = {
  width: "cells",
  height: "cells",
  target_food_count: "pcs",
  food_overflow_limit: "pcs",
  cluster_count: "pcs",
  cluster_spawn_chance: "fraction",
  cluster_spread: "cells",
  cluster_move_chance: "fraction",
  tick_rate: "Hz",
  base_speed_per_second: "cells/s",
  max_turn_speed_deg_per_second: "°/s",
  min_turn_radius: "cells",
  turn_radius_thickness_coeff: "coeff",
  turn_idle_smoothing_at_20hz: "coeff",
  turn_active_smoothing_at_20hz: "coeff",
  start_length: "segm",
  start_score: "points",
  base_head_radius: "cells",
  score_thickness_scale: "coeff",
  camera_zoom_out_coeff: "coeff",
  growth_score_per_segment: "formula",
  max_growth_score: "score",
  min_body_length: "segm",
  safe_spawn_distance: "cells",
  min_score: "points",
  speed_multiplier: "x",
  drain_interval_seconds: "sec",
  drain_per_interval: "points",
  food_drop_value: "points",
  base_radius: "cells",
  radius_value_scale: "coeff",
  death_drop_score_fraction: "fraction",
  attraction_radius: "cells",
  attraction_speed: "cells/s",
  aoi_radius: "cells",
  aoi_length_padding: "coeff",
  min_fog_radius: "cells",
  fog_score_expansion_coeff: "coeff",
  camera_base_zoom: "coeff",
  camera_pitch_angle: "°",
  camera_z_height: "cells",
  camera_y_offset: "cells",
  mouse_sensitivity: "coeff",
  portals_enabled: "0/1",
  portals_count: "pairs",
  portals_radius: "cells",
  black_holes_enabled: "0/1",
  black_holes_count: "slots",
  black_holes_spawn_chance: "chance",
  black_holes_pull_radius: "cells",
  black_holes_pull_force: "cells/s",
  black_holes_kill_radius: "cells",
  black_holes_growth_time: "sec"
};

const HIDDEN_FIELDS = new Set(["types", "aoi_radius", "aoi_length_padding"]);
const FIELDS_TO_HIDE_FROM_LIST = new Set(["types", "width", "height", "aoi_radius", "aoi_length_padding"]);

function adminApiUrl() {
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol;
  const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
  
  if (isStandardPort) {
    return `${protocol}//${host}/ws/admin/config`;
  }
  return `${protocol}//${host}:8000/admin/config`;
}

const parseSafeInt = (val: string | undefined, fallback: number): number => {
  if (val === undefined || val === "") return fallback;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? fallback : parsed;
};

const parseSafeFloat = (val: string | undefined, fallback: number): number => {
  if (val === undefined || val === "") return fallback;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? fallback : parsed;
};

type SimulatedData = {
  width: number;
  height: number;
  clusters: { x: number; y: number }[];
  foods: { x: number; y: number; color: string; value: number }[];
  clusterSpread: number;
};

function MapSimulator({ simulatedData }: { 
  simulatedData: SimulatedData | null;
}) {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !simulatedData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width: mapW, height: mapH, clusters, foods, clusterSpread } = simulatedData;

    // Fixed width for display, compute height to match map aspect ratio
    // Subtract parent's padding (24px) to ensure no container layout overflow
    const parentW = canvas.parentElement?.clientWidth || 324;
    const displayWidth = Math.max(200, parentW - 24);
    const aspectRatio = mapH / mapW;
    
    // Limit height to avoid ultra-long maps breaking UI
    let displayHeight = displayWidth * aspectRatio;
    let finalWidth = displayWidth;
    
    const maxHeight = 400;
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      finalWidth = displayHeight / aspectRatio;
    }

    // Handle high DPI screens
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = finalWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${finalWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.scale(dpr, dpr);

    // Coordinate mapping: map coordinate [0, mapW] -> canvas pixel [0, finalWidth]
    const scaleX = finalWidth / mapW;
    const scaleY = displayHeight / mapH;
    const scale = Math.min(scaleX, scaleY);

    // Center the map in canvas if aspect ratios don't match perfectly due to capping
    const offsetX = (finalWidth - mapW * scale) / 2;
    const offsetY = (displayHeight - mapH * scale) / 2;

    const mapToCanvas = (x: number, y: number) => {
      return {
        cx: offsetX + x * scale,
        cy: offsetY + y * scale
      };
    };

    // Draw background
    ctx.fillStyle = "#1e2025";
    ctx.fillRect(0, 0, finalWidth, displayHeight);

    // Draw grid lines (every 10 map cells)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = 0; x <= mapW; x += 10) {
      const p1 = mapToCanvas(x, 0);
      const p2 = mapToCanvas(x, mapH);
      ctx.beginPath();
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
      ctx.stroke();
    }
    // Horizontal grid lines
    for (let y = 0; y <= mapH; y += 10) {
      const p1 = mapToCanvas(0, y);
      const p2 = mapToCanvas(mapW, y);
      ctx.beginPath();
      ctx.moveTo(p1.cx, p1.cy);
      ctx.lineTo(p2.cx, p2.cy);
      ctx.stroke();
    }

    // Draw map border (glowing red border matching game styling)
    ctx.strokeStyle = "#e63946";
    ctx.lineWidth = 2;
    const tl = mapToCanvas(0, 0);
    ctx.strokeRect(tl.cx, tl.cy, mapW * scale, mapH * scale);

    // Draw cluster zones (circles matching cluster_spread)
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.strokeStyle = "rgba(59, 130, 246, 0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]); // dashed circles
    
    for (const cluster of clusters) {
      const { cx, cy } = mapToCanvas(cluster.x, cluster.y);
      const r = clusterSpread * scale;
      
      // Draw spread circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Draw cluster center dot
      ctx.fillStyle = "rgba(59, 130, 246, 0.5)";
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(59, 130, 246, 0.08)"; // Restore
    }
    ctx.setLineDash([]); // Reset line dash

    // Draw food particles
    for (const food of foods) {
      const { cx, cy } = mapToCanvas(food.x, food.y);
      
      // Base radius of food drawn as colored dot
      // Scale dot radius between 1.5px and 6px based on value and map scale
      const dotRad = Math.max(1.5, Math.min(5, (0.2 + Math.sqrt(food.value) * 0.1) * scale * 2.5));
      
      // Shadow / glow around food
      ctx.fillStyle = food.color;
      ctx.shadowColor = food.color;
      ctx.shadowBlur = 4;
      
      ctx.beginPath();
      ctx.arc(cx, cy, dotRad, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Reset shadow blur for other drawings
    ctx.shadowBlur = 0;

  }, [simulatedData]);

  if (!simulatedData) return null;

  return (
    <div style={{
      position: "relative",
      background: "#24262c",
      border: "1px solid #3f414a",
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 12,
      minHeight: 200,
      boxShadow: "inset 0 4px 20px rgba(0,0,0,0.4)"
    }}>
      <canvas ref={canvasRef} style={{ display: "block", borderRadius: 6 }} />
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("snake-admin-password") || "";
  });
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [foodTypes, setFoodTypes] = useState<FoodTypeDraft[]>([]);
  const [status, setStatus] = useState("Enter admin password to authorize");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [healthData, setHealthData] = useState<{ online: boolean; players: number; ping: number | null }>({
    online: false,
    players: 0,
    ping: null,
  });
  const [simSeed, setSimSeed] = useState(0);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isAdminSidePanelOpen, setIsAdminSidePanelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const simulatedData = useMemo(() => {
    if (!config) return null;

    const wVal = parseSafeInt(drafts["world.width"], config ? Number((config.world as any).width) : 100);
    const hVal = parseSafeInt(drafts["world.height"], config ? Number((config.world as any).height) : 100);
    const width = Math.max(20, Math.min(10000, wVal));
    const height = Math.max(20, Math.min(10000, hVal));

    const fCountVal = parseSafeInt(drafts["world.target_food_count"], config ? Number((config.world as any).target_food_count) : 250);
    const targetFoodCount = Math.max(0, Math.min(2000, fCountVal));

    const cCountVal = parseSafeInt(drafts["world.cluster_count"], config ? Number((config.world as any).cluster_count) : 8);
    const clusterCount = Math.max(1, Math.min(200, cCountVal));

    const cChanceVal = parseSafeFloat(drafts["world.cluster_spawn_chance"], config ? Number((config.world as any).cluster_spawn_chance) : 0.8);
    const clusterSpawnChance = Math.max(0, Math.min(1, cChanceVal));

    const cSpreadVal = parseSafeFloat(drafts["world.cluster_spread"], config ? Number((config.world as any).cluster_spread) : 5.0);
    const clusterSpread = Math.max(0.1, Math.min(1000, cSpreadVal));

    // Extract food types
    const types = foodTypes.map(ft => ({
      value: Number(ft.value) || 1,
      weight: Math.max(1, Number(ft.weight) || 1),
      color: ft.color || "#ef4444"
    }));

    if (types.length === 0) {
      types.push({ value: 1, weight: 1, color: "#ef4444" });
    }

    // Seeded pseudo-random generator (LCG)
    let lcgSeed = simSeed + 1;
    const lcgRandom = () => {
      const x = Math.sin(lcgSeed++) * 10000;
      return x - Math.floor(x);
    };

    // Create clusters
    const clusters: { x: number; y: number }[] = [];
    for (let i = 0; i < clusterCount; i++) {
      clusters.push({
        x: 10 + lcgRandom() * (width - 20),
        y: 10 + lcgRandom() * (height - 20)
      });
    }

    // Generate food
    const foods: { x: number; y: number; color: string; value: number }[] = [];
    
    // Choose type based on weights
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    const getWeightedType = () => {
      let rand = lcgRandom() * totalWeight;
      for (const t of types) {
        if (rand < t.weight) return t;
        rand -= t.weight;
      }
      return types[0];
    };

    // Box-Muller Gaussian random approximation
    const randomNormal = (mean: number, stdDev: number) => {
      const u1 = lcgRandom() || 0.0001;
      const u2 = lcgRandom() || 0.0001;
      const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
      return mean + stdDev * randStdNormal;
    };

    for (let i = 0; i < targetFoodCount; i++) {
      const chosen = getWeightedType();
      let x = 0;
      let y = 0;

      if (lcgRandom() < clusterSpawnChance && clusters.length > 0) {
        const cluster = clusters[Math.floor(lcgRandom() * clusters.length)];
        x = randomNormal(cluster.x, clusterSpread);
        y = randomNormal(cluster.y, clusterSpread);
      } else {
        x = lcgRandom() * (width - 2);
        y = lcgRandom() * (height - 2);
      }

      x = Math.max(1, Math.min(width - 1, x));
      y = Math.max(1, Math.min(height - 1, y));

      foods.push({ x, y, color: chosen.color, value: chosen.value });
    }

    return {
      width,
      height,
      clusters,
      foods,
      clusterSpread
    };
  }, [
    drafts["world.width"],
    drafts["world.height"],
    drafts["world.target_food_count"],
    drafts["world.cluster_count"],
    drafts["world.cluster_spawn_chance"],
    drafts["world.cluster_spread"],
    foodTypes,
    config,
    simSeed
  ]);

  const showMinimap = !!config && (activeTab === "all" || activeTab === "world_network" || activeTab === "food_boost");

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
    setStatus("Loading current balance parameters...");
    try {
      const response = await fetch(apiUrl, {
        headers: { "x-admin-password": passwordOverride },
      });
      if (!response.ok) {
        setStatus(`Access error: Invalid password (${response.status})`);
        return;
      }
      applyLoadedConfig(await response.json() as GameConfig);
      setStatus("Balance parameters loaded successfully from server");
      window.localStorage.setItem("snake-admin-password", passwordOverride);
    } catch (e) {
      setStatus(`Failed to connect to server: ${String(e)}`);
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
          if (key === "growth_score_per_segment") {
            patch[section][key] = draft;
          } else {
            patch[section][key] = Number(draft);
          }
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
      setStatus("No changes detected");
      return;
    }
    setStatus("Applying new parameters...");
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
        const errMsg = error?.detail || `Error saving config: ${response.status}`;
        setStatus(errMsg);
        
        const lowerMsg = errMsg.toLowerCase();
        if (
          lowerMsg.includes("formula") || 
          lowerMsg.includes("syntax") || 
          lowerMsg.includes("variable") || 
          lowerMsg.includes("operator") || 
          lowerMsg.includes("function") || 
          lowerMsg.includes("math constant") || 
          lowerMsg.includes("growth_score_per_segment") ||
          lowerMsg.includes("growth segment cost")
        ) {
          setFormulaError(errMsg);
        }
        return;
      }
      setFormulaError(null);
      applyLoadedConfig(await response.json() as GameConfig);
      setStatus("✓ Configuration successfully updated in real-time!");
    } catch (e) {
      setStatus(`Network error while sending patch: ${String(e)}`);
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
    setStatus("All local changes reset to server defaults");
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

  const handleRestartGame = useCallback(async () => {
    try {
      const host = window.location.hostname || "127.0.0.1";
      const protocol = window.location.protocol;
      const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
      const restartUrl = isStandardPort
        ? `${protocol}//${host}/ws/admin/restart`
        : `${protocol}//${host}:8000/admin/restart`;

      const res = await fetch(restartUrl, {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      if (!res.ok) {
        const detail = await res.text();
        setStatus(`Restart failed: ${detail}`);
      } else {
        setStatus("✓ Game restarted successfully. All players disconnected.");
      }
    } catch (e) {
      setStatus(`Restart error: ${String(e)}`);
    }
    setShowRestartConfirm(false);
  }, [password]);

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
        if (FIELDS_TO_HIDE_FROM_LIST.has(key)) continue;
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
    <main className="admin-main">
      <style>{`
        .admin-main {
          min-height: 100vh;
          background: #2b2d34;
          color: #fafafa;
          padding: 0 24px 48px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          overflow-x: hidden;
        }
        @media (max-width: 600px) {
          .admin-main {
            padding: 0 12px 24px !important;
          }
          .standard-panel {
            padding: 24px 16px !important;
          }
        }
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
          min-width: 0;
        }
        .admin-input:focus {
          border-color: #e63946 !important;
          box-shadow: 0 0 0 2px rgba(230, 57, 70, 0.15);
          outline: none;
        }
        @media (max-width: 480px) {
          .admin-title {
            font-size: 18px !important;
          }
        }
        @media (max-width: 360px) {
          .admin-title {
            font-size: 15px !important;
          }
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
          display: "flex", flexDirection: "column", gap: 12, 
          marginBottom: 32, 
          position: "sticky", top: 0, zIndex: 100, 
          background: "#2b2d34", 
          padding: "28px 0 16px", borderBottom: "1px solid #3f414a" 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 20 }}>
            {/* Title block */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.1em" }}>🛠️</span>
              <h1 className="admin-title" style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", background: "linear-gradient(to right, #fafafa, #a1a1aa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Balance Console
              </h1>
            </div>

            {/* Controls (Desktop / Mobile) */}
            {config && (
              <div>
                {!isMobile ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {/* Search */}
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="admin-input"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #3f414a",
                          background: "#30323a",
                          color: "#fafafa",
                          fontSize: 13,
                          width: 140,
                        }}
                      />
                      {searchQuery && (
                        <span 
                          onClick={() => setSearchQuery("")}
                          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#a1a1aa", fontSize: 11 }}
                        >
                          ✕
                        </span>
                      )}
                    </div>

                    {/* Debug Mode */}
                    <a
                      href="/?debug=true"
                      style={{
                        textDecoration: "none",
                        padding: "6px 14px",
                        borderRadius: 8,
                        background: "rgba(230, 57, 70, 0.1)",
                        border: "1px solid #e63946",
                        color: "#e63946",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "inline-flex",
                        alignItems: "center",
                        height: "32px",
                        boxSizing: "border-box"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(230, 57, 70, 0.2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(230, 57, 70, 0.1)"; }}
                    >
                      Debug Mode
                    </a>

                    {/* Main Page */}
                    <a
                      href="/"
                      style={{
                        textDecoration: "none",
                        padding: "6px 14px",
                        borderRadius: 8,
                        background: "rgba(255, 255, 255, 0.06)",
                        color: "#fafafa",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "background 0.2s",
                        display: "inline-flex",
                        alignItems: "center",
                        height: "32px",
                        boxSizing: "border-box"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"; }}
                    >
                      Main Page
                    </a>

                    {/* Restart Game */}
                    <button
                      type="button"
                      onClick={() => setShowRestartConfirm(true)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        background: "rgba(245, 158, 11, 0.1)",
                        color: "#f59e0b",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        transition: "all 0.2s",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        height: "32px",
                        boxSizing: "border-box" as const
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245, 158, 11, 0.2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245, 158, 11, 0.1)"; }}
                    >
                      🔄 Restart
                    </button>

                    {/* Logout */}
                    <button 
                      type="button" 
                      onClick={() => {
                        window.localStorage.removeItem("snake-admin-password");
                        setPassword("");
                        setConfig(null);
                        setStatus("Session terminated");
                      }} 
                      className="btn-action"
                      style={{ 
                        padding: "6px 14px", borderRadius: 8, border: "none",
                        background: "rgba(255, 255, 255, 0.06)", color: "#fafafa", fontWeight: 600, fontSize: 13,
                        cursor: "pointer",
                        transition: "background 0.2s",
                        height: "32px",
                        boxSizing: "border-box"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"; }}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="admin-input"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid #3f414a",
                          background: "#30323a",
                          color: "#fafafa",
                          fontSize: 13,
                          width: 100,
                        }}
                      />
                      {searchQuery && (
                        <span 
                          onClick={() => setSearchQuery("")}
                          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#a1a1aa", fontSize: 11 }}
                        >
                          ✕
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdminSidePanelOpen(true)}
                      style={{ background: "none", border: "none", color: "#fafafa", fontSize: 24, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}
                      title="Menu"
                    >
                      ☰
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Server stats and status message row */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              background: "rgba(48, 50, 58, 0.85)",
              border: "1px solid rgba(63, 65, 74, 0.6)",
              padding: "6px 16px",
              borderRadius: "30px",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              backdropFilter: "blur(4px)",
              color: "#fafafa",
              alignSelf: "flex-start"
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
            
            <p style={{ margin: "2px 0 0", color: "#a1a1aa", fontSize: 14, fontWeight: 500 }}>
              {status}
            </p>
          </div>
        </header>

        {!config ? (
          <div style={{ 
            maxWidth: 550, margin: "80px auto 0", 
            borderRadius: 16, padding: "32px 40px", 
            textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.15)" 
          }} className="standard-panel">
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h2 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700 }}>Authorization Required</h2>
            <p style={{ color: "#a1a1aa", fontSize: 14, lineHeight: "1.6", margin: "0 0 24px" }}>
              To manage the game balance, food spawning, snake physics, and visual parameters, please enter the administrator password.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", width: "100%", maxWidth: 360, margin: "0 auto" }}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                style={{ 
                  padding: "12px 16px", borderRadius: 8, border: "1px solid #3f414a",
                  background: "#2b2d34", color: "#fafafa", flex: "1 1 180px", minWidth: 0, fontSize: 14 
                }}
              />
              <button 
                type="button" 
                onClick={() => void loadConfig()} 
                className="btn-action"
                style={{ 
                  padding: "12px 24px", borderRadius: 8, border: "none",
                  background: "#e63946", color: "#fff", fontWeight: 700, fontSize: 14,
                  boxShadow: "0 4px 12px rgba(230, 57, 70, 0.2)", flex: "1 1 auto"
                }}
              >
                Login
              </button>
            </div>
            <p style={{ margin: "24px 0 0", color: "#a1a1aa", fontSize: 12 }}>
              In development (dev) mode, the default password is: <code>admin</code>
            </p>
          </div>
        ) : (
          <div>
            {/* ТАБЫ & ПОИСК (Desktop only) */}
            {!isMobile && (
              <div style={{ 
                display: "flex", justifyContent: "flex-start", alignItems: "center", 
                gap: 16, marginBottom: 28, flexWrap: "wrap" 
              }}>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={`admin-tab ${activeTab === "all" ? "active" : ""}`}
                    style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer" }}
                  >
                    🗂️ All Settings
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
              </div>
            )}

            {/* MAIN CONTENT */}
            {activeTabFields.length === 0 && searchQuery ? (
              <div style={{ border: "1px solid #3f414a", borderRadius: 12, padding: "40px 20px", textAlign: "center", background: "#30323a", color: "#a1a1aa" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                No settings found for "{searchQuery}" in the current section.
              </div>
            ) : (
              <div className="admin-content-layout" style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr", 
                gap: 32, 
                width: "100%",
                alignItems: "start"
              }}>
                {/* LEFT COLUMN: SETTINGS */}
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  {Object.entries(NEW_SECTIONS).map(([secKey, secInfo]) => {
                    const fieldsInSec = groupedFields[secKey] || [];
                    if (fieldsInSec.length === 0) return null;

                    return (
                      <div key={secKey} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        
                        {/* Category block header */}
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

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))", gap: 16 }}>
                          {config && (secKey === "world_network") && (
                            !searchQuery || 
                            "map size".includes(searchQuery.toLowerCase()) || 
                            "width".includes(searchQuery.toLowerCase()) || 
                            "height".includes(searchQuery.toLowerCase()) || 
                            "width".includes(searchQuery.toLowerCase()) || 
                            "height".includes(searchQuery.toLowerCase())
                          ) && (() => {
                            const wDraft = drafts["world.width"] ?? String(config.world.width);
                            const hDraft = drafts["world.height"] ?? String(config.world.height);
                            const isWMody = wDraft !== String(config.world.width);
                            const isHMody = hDraft !== String(config.world.height);
                            const isMody = isWMody || isHMody;

                            return (
                              <div 
                                className={`setting-card ${isMody ? "modified" : ""}`}
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
                                      <span style={{ color: "#fafafa", fontSize: 14, fontWeight: 600 }}>Map Size</span>
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
                                          zIndex: 200,
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
                                          The width and height of the game board in cells. A square or rectangular map is recommended.
                                        </div>
                                      </div>
                                    </div>
                                    {isMody && (
                                      <span style={{ color: "#f59e0b", fontSize: 10, fontWeight: 700, background: "rgba(245, 158, 11, 0.15)", padding: "2px 6px", borderRadius: 10 }}>
                                        modified
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#a1a1aa", wordBreak: "break-all", marginBottom: 12 }}>
                                    world.width × world.height
                                  </div>
                                </div>

                                <div>
                                  {isMody && (
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#a1a1aa", marginBottom: 6, padding: "0 2px" }}>
                                      <span>Was: <strong style={{ color: "#8a8b94" }}>{String(config.world.width)} × {String(config.world.height)}</strong></span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          resetSingleField("world.width", config.world.width);
                                          resetSingleField("world.height", config.world.height);
                                        }}
                                        style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}
                                      >
                                        Reset ↺
                                      </button>
                                    </div>
                                  )}

                                  <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                    <input
                                      value={wDraft}
                                      onChange={(e) => setDrafts(prev => ({ ...prev, ["world.width"]: e.target.value }))}
                                      className="admin-input"
                                      placeholder="Width"
                                      style={{
                                        flex: 1,
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: `1px solid ${isWMody ? "#d97706" : "#3f414a"}`,
                                        background: "#2b2d34",
                                        color: "#fafafa",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        textAlign: "center"
                                      }}
                                    />
                                    <span style={{ color: "#a1a1aa", fontWeight: 700, fontSize: 14 }}>×</span>
                                    <input
                                      value={hDraft}
                                      onChange={(e) => setDrafts(prev => ({ ...prev, ["world.height"]: e.target.value }))}
                                      className="admin-input"
                                      placeholder="Height"
                                      style={{
                                        flex: 1,
                                        width: "100%",
                                        padding: "10px 12px",
                                        borderRadius: 8,
                                        border: `1px solid ${isHMody ? "#d97706" : "#3f414a"}`,
                                        background: "#2b2d34",
                                        color: "#fafafa",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        textAlign: "center"
                                      }}
                                    />
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
                                      cells
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

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
                                            zIndex: 200,
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
                                        modified
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
                                      <span>Was: <strong style={{ color: "#8a8b94" }}>{String(f.value)}</strong></span>
                                      <button 
                                        type="button" 
                                        onClick={() => resetSingleField(f.dk, f.value)}
                                        style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}
                                      >
                                        Reset ↺
                                      </button>
                                    </div>
                                  )}

                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, width: "100%" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                      <input
                                        value={draftVal}
                                        onChange={(e) => {
                                          setDrafts(prev => ({ ...prev, [f.dk]: e.target.value }));
                                          if (f.key === "growth_score_per_segment") {
                                            setFormulaError(null);
                                          }
                                        }}
                                        className="admin-input"
                                        style={{
                                          flex: 1,
                                          width: "100%",
                                          padding: "10px 12px",
                                          borderRadius: 8,
                                          border: `1px solid ${
                                            f.key === "growth_score_per_segment" && formulaError 
                                              ? "#ef4444" 
                                              : isFieldModified ? "#d97706" : "#3f414a"
                                          }`,
                                          boxShadow: f.key === "growth_score_per_segment" && formulaError 
                                            ? "0 0 8px rgba(239, 68, 68, 0.2)" 
                                            : "none",
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
                                    
                                    {f.key === "growth_score_per_segment" && formulaError && (
                                      <div style={{
                                        color: "#f87171",
                                        fontSize: 11,
                                        fontWeight: 500,
                                        background: "rgba(239, 68, 68, 0.08)",
                                        border: "1px solid rgba(239, 68, 68, 0.2)",
                                        padding: "8px 12px",
                                        borderRadius: 6,
                                        lineHeight: "1.4",
                                        pointerEvents: "auto"
                                      }}>
                                        ⚠️ <strong>Formula Error:</strong> {formulaError}
                                        <div style={{ marginTop: 4, color: "#a1a1aa", fontSize: 10 }}>
                                          Use variables <code>s</code> (score) or <code>l</code> (length). Examples: <code>10</code>, <code>10 + l * 0.5</code>, <code>15 + log(s) * 3</code>.
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Map Simulator inside World & Network block */}
                        {secKey === "world_network" && (activeTab === "world_network" || activeTab === "all") && !searchQuery && (
                          <div style={{ 
                            marginTop: 12, 
                            border: "1px solid #3f414a", 
                            borderRadius: 12, 
                            padding: 20, 
                            background: "#30323a" 
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 22 }}>🗺️</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fafafa" }}>
                                    Map Simulation
                                  </h3>
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
                                      zIndex: 200,
                                      bottom: "125%",
                                      left: "50%",
                                      marginLeft: -120,
                                      opacity: 0,
                                      transition: "opacity 0.2s ease, transform 0.2s ease",
                                      transform: "translateY(4px)",
                                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                                      fontSize: 11,
                                      lineHeight: "1.4",
                                      pointerEvents: "none",
                                      border: "1px solid #3f414a"
                                    }}>
                                      Preview of the food and cluster layout based on your current settings. Updates in real-time as you modify parameters.
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSimSeed(s => s + 1)}
                                className="btn-action"
                                style={{
                                  background: "rgba(255,255,255,0.06)",
                                  border: "1px solid #3f414a",
                                  color: "#fafafa",
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer"
                                }}
                              >
                                🎲 Roll Seed
                              </button>
                            </div>

                            <MapSimulator simulatedData={simulatedData} />

                            {/* Simulation Stats Panel */}
                            <div style={{
                              marginTop: 20,
                              borderTop: "1px solid #3f414a",
                              paddingTop: 16,
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: 12,
                              fontSize: 12
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "#a1a1aa" }}>Grid Size:</span>
                                <span style={{ color: "#fafafa", fontFamily: "monospace", fontWeight: 600 }}>
                                  {simulatedData?.width} × {simulatedData?.height} cells
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "#a1a1aa" }}>Simulated Food:</span>
                                <span style={{ color: "#fafafa", fontFamily: "monospace", fontWeight: 600 }}>
                                  {simulatedData?.foods.length} items
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "#a1a1aa" }}>Food Clusters:</span>
                                <span style={{ color: "#fafafa", fontFamily: "monospace", fontWeight: 600 }}>
                                  {simulatedData?.clusters.length} zones
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "#a1a1aa" }}>Cluster Spread:</span>
                                <span style={{ color: "#fafafa", fontFamily: "monospace", fontWeight: 600 }}>
                                  {simulatedData?.clusterSpread.toFixed(1)} cells
                                </span>
                              </div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ color: "#a1a1aa" }}>Cluster Chance:</span>
                                <span style={{ color: "#fafafa", fontFamily: "monospace", fontWeight: 600 }}>
                                  {Math.round((Math.max(0, Math.min(1, parseFloat(drafts["world.cluster_spawn_chance"]) ?? (config ? Number(config.world.cluster_spawn_chance) : 0.8))) * 100))}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Special section "Food Types" in tab "Food & Boost" or tab "All" */}
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
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🍎 Food Types & Spawning Settings</h3>
                                <p style={{ margin: "4px 0 0", color: "#a1a1aa", fontSize: 13 }}>
                                  Different types of apples, their spawn weight (chance), and color rendering on the map.
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
                                + Add Food Type
                              </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
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
                                        Value: {ft.value} points
                                      </div>
                                      <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>
                                        Spawn weight: {ft.weight}
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
                                        <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Points (Value)</span>
                                        <input value={ft.value} onChange={(e) => updateFoodType(i, "value", e.target.value)} className="admin-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #3f414a", background: "#2b2d34", color: "#fafafa", fontSize: 13 }} />
                                      </label>
                                      
                                      <label style={{ display: "grid", gap: 4 }}>
                                        <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Weight (Spawn Weight)</span>
                                        <input value={ft.weight} onChange={(e) => updateFoodType(i, "weight", e.target.value)} className="admin-input" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #3f414a", background: "#2b2d34", color: "#fafafa", fontSize: 13 }} />
                                      </label>

                                      <label style={{ display: "grid", gap: 4 }}>
                                        <span style={{ color: "#a1a1aa", fontSize: 12, fontWeight: 500 }}>Color</span>
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
              </div>
            )}

          </div>
        )}

        {/* Floating Action Panel in Bottom-Right Corner - Positioned Fixed Outside Grid */}
        {hasChanges && (
          <div 
            className="floating-action-panel"
            style={{
              position: "fixed",
              bottom: 24,
              right: isMobile ? 12 : 24,
              left: isMobile ? 12 : "auto",
              zIndex: 9999, // Super high z-index to overlay everything on the screen
              background: "rgba(36, 38, 44, 0.98)", // dark high-opacity backdrop
              border: "1px solid #f59e0b",
              borderRadius: 16,
              padding: "16px 20px",
              boxShadow: "0 10px 35px rgba(0, 0, 0, 0.5), 0 0 25px rgba(245, 158, 11, 0.25)",
              backdropFilter: "blur(12px)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              maxWidth: isMobile ? "calc(100vw - 24px)" : 320,
              color: "#fafafa",
              pointerEvents: "auto"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>Unsaved changes!</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: "1.4" }}>
              You have modified the balance parameters. Apply them to update the game world in real-time.
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
                Reset
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
                Apply ({sectionModifiedCounts.all})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side Panel Drawer Backdrop Overlay (admin) */}
      {isMobile && isAdminSidePanelOpen && (
        <div 
          onClick={() => setIsAdminSidePanelOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 105,
            transition: "opacity 0.3s ease"
          }}
        />
      )}

      {/* Side Panel Drawer (admin) */}
      {isMobile && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "280px",
          background: "rgba(30, 32, 40, 0.95)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "-10px 0 32px rgba(0, 0, 0, 0.5)",
          zIndex: 110,
          transform: isAdminSidePanelOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 20px",
          color: "white"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Navigation</span>
            <div 
              onClick={() => setIsAdminSidePanelOpen(false)}
              style={{ cursor: "pointer", fontSize: "18px", opacity: 0.6, padding: "4px" }}
            >
              ✕
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            <button
              type="button"
              onClick={() => { setActiveTab("all"); setIsAdminSidePanelOpen(false); }}
              className={`admin-tab ${activeTab === "all" ? "active" : ""}`}
              style={{ padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
            >
              🗂️ All Settings
              {sectionModifiedCounts.all > 0 && (
                <span style={{ marginLeft: "auto", background: activeTab === "all" ? "#fff" : "#f59e0b", color: activeTab === "all" ? "#e63946" : "#2b2d34", padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
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
                  onClick={() => { setActiveTab(secKey); setIsAdminSidePanelOpen(false); }}
                  className={`admin-tab ${activeTab === secKey ? "active" : ""}`}
                  style={{ padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                >
                  <span>{secInfo.icon}</span>
                  <span style={{ flex: 1 }}>{secInfo.title}</span>
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

            <a
              href="/?debug=true"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "rgba(230, 57, 70, 0.1)",
                color: "#e63946",
                border: "1px solid #e63946",
                cursor: "pointer",
                transition: "all 0.2s",
                marginTop: "auto",
                justifyContent: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(230, 57, 70, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(230, 57, 70, 0.1)";
              }}
            >
              🐛 Debug Mode
            </a>

            <a
              href="/"
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "#30323a",
                color: "#a1a1aa",
                border: "1px solid #3f414a",
                cursor: "pointer",
                transition: "all 0.2s",
                justifyContent: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#3f414a";
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.borderColor = "#52545d";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#30323a";
                e.currentTarget.style.color = "#a1a1aa";
                e.currentTarget.style.borderColor = "#3f414a";
              }}
            >
              🎮 Main Page
            </a>

            {config && (
              <button
                type="button"
                onClick={() => { setShowRestartConfirm(true); setIsAdminSidePanelOpen(false); }}
                style={{
                  marginTop: 10,
                  padding: "12px 14px", borderRadius: 8,
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  background: "rgba(245, 158, 11, 0.1)",
                  color: "#f59e0b", fontWeight: 700, fontSize: 14,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                🔄 Restart Game
              </button>
            )}

            {config && (
              <button 
                type="button" 
                onClick={() => {
                  window.localStorage.removeItem("snake-admin-password");
                  setPassword("");
                  setConfig(null);
                  setStatus("Session terminated");
                  setIsAdminSidePanelOpen(false);
                }} 
                className="btn-action"
                style={{ 
                  marginTop: 10,
                  padding: "12px 14px", borderRadius: 8, border: "none",
                  background: "#e63946", color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: "pointer",
                  textAlign: "center"
                }}
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setShowRestartConfirm(false)}
        >
          <div
            style={{
              background: "#1e1f26",
              borderRadius: 16,
              border: "1px solid rgba(245, 158, 11, 0.3)",
              padding: "28px 32px",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.1)",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ color: "#f59e0b", fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>
              Restart Game?
            </h3>
            <p style={{ color: "#a1a1aa", fontSize: 13, lineHeight: 1.6, margin: "0 0 24px" }}>
              This will disconnect all players and reset the game state.
              Food will be re-spawned and all scores will be lost.
              Configuration settings will be preserved.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowRestartConfirm(false)}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.06)",
                  color: "#fafafa",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)"; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestartGame}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: "#e63946",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#c62e3b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#e63946"; }}
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
