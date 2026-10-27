// ROLE: Graphics quality presets, persistence and the quality control contract. No rendering.
export type RenderQuality = "auto" | "high" | "medium" | "low";

export interface QualityPreset {
  pixelRatioCap: number;
  adaptive: boolean;
  shadows: boolean;
  ssao: boolean;
  bloom: boolean;
}

export const DEFAULT_RENDER_QUALITY: RenderQuality = "auto";
export const RENDER_QUALITY_STORAGE_KEY = "snake-quality";

export const QUALITY_PRESETS: Record<RenderQuality, QualityPreset> = {
  auto: { pixelRatioCap: 2, adaptive: true, shadows: true, ssao: true, bloom: true },
  high: { pixelRatioCap: 2, adaptive: false, shadows: true, ssao: true, bloom: true },
  medium: { pixelRatioCap: 1.5, adaptive: false, shadows: true, ssao: false, bloom: true },
  low: { pixelRatioCap: 1, adaptive: false, shadows: false, ssao: false, bloom: false },
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
