// ROLE: Graphics quality presets (shadow map, contact shadow, grass and snake-light budgets), persistence and the quality control contract. No rendering.
export type RenderQuality = "auto" | "high" | "medium" | "low";

export interface QualityPreset {
  pixelRatioCap: number;
  adaptive: boolean;
  shadows: boolean;
  shadowMapSize: number;
  shadowRadius: number;
  snakeLights: number;
  ssao: boolean;
  bloom: boolean;
  /** Base resolution of the world-space snake contact shadow at the reference box. */
  contactShadow: number;
  /** Dense grass tuft budget; 0 disables the field entirely. */
  grass: number;
  /** Stone accent budget; 0 disables props. */
  stones: number;
}

export const DEFAULT_RENDER_QUALITY: RenderQuality = "auto";
export const RENDER_QUALITY_STORAGE_KEY = "snake-quality";

export const QUALITY_PRESETS: Record<RenderQuality, QualityPreset> = {
  auto: {
    pixelRatioCap: 2,
    adaptive: true,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 3,
    snakeLights: 3,
    ssao: true,
    bloom: true,
    contactShadow: 512,
    grass: 6000,
    stones: 144,
  },
  high: {
    pixelRatioCap: 2,
    adaptive: false,
    shadows: true,
    shadowMapSize: 2048,
    shadowRadius: 3,
    snakeLights: 3,
    ssao: true,
    bloom: true,
    contactShadow: 512,
    grass: 6000,
    stones: 144,
  },
  medium: {
    pixelRatioCap: 1.5,
    adaptive: false,
    shadows: true,
    shadowMapSize: 1024,
    shadowRadius: 2,
    snakeLights: 2,
    ssao: false,
    bloom: true,
    contactShadow: 512,
    grass: 2500,
    stones: 72,
  },
  low: {
    pixelRatioCap: 1,
    adaptive: false,
    shadows: false,
    shadowMapSize: 512,
    shadowRadius: 0,
    snakeLights: 1,
    ssao: false,
    bloom: false,
    contactShadow: 256,
    grass: 0,
    stones: 0,
  },
};

export interface RenderQualityControl {
  getQuality(): RenderQuality;
  setQuality(quality: RenderQuality): void;
}

export function isRenderQuality(value: string | null): value is RenderQuality {
  return value === "auto" || value === "high" || value === "medium" || value === "low";
}

export function loadRenderQuality(): RenderQuality {
  try {
    const stored = localStorage.getItem(RENDER_QUALITY_STORAGE_KEY);
    return isRenderQuality(stored) ? stored : DEFAULT_RENDER_QUALITY;
  } catch {
    return DEFAULT_RENDER_QUALITY;
  }
}

export function saveRenderQuality(quality: RenderQuality): void {
  try {
    localStorage.setItem(RENDER_QUALITY_STORAGE_KEY, quality);
  } catch {
    // Storage can be unavailable in private mode; the current session still works.
  }
}
