// ROLE: parseColor and skin-specific glow tints. No rendering or game logic.

const colorCache = new Map<string, number>();

export const parseColor = (colorStr: string): number => {
  if (!colorStr) return 0x22c55e;
  const cached = colorCache.get(colorStr);
  if (cached !== undefined) return cached;

  const parsed = parseInt(colorStr.replace("#", "0x"), 16) || 0x22c55e;
  colorCache.set(colorStr, parsed);
  return parsed;
};

const SKIN_GLOW_COLORS: Record<string, number> = {
  zebra: 0xf4f7ff,
  tiger: 0xff9d3c,
  cyberpunk: 0xff45e8,
  rainbow: 0x8af4ff,
};

/** Skin colors that are patterns have no single hex value; pick a readable glow tint. */
export const resolveSkinGlowColor = (skin: string): number => {
  return SKIN_GLOW_COLORS[skin] ?? parseColor(skin);
};
