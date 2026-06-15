// ROLE: parseColor, lerpColors, hslToHex.

const colorCache = new Map<string, number>();

export const parseColor = (colorStr: string): number => {
  if (!colorStr) return 0x22c55e;
  const cached = colorCache.get(colorStr);
  if (cached !== undefined) return cached;
  
  const parsed = parseInt(colorStr.replace('#', '0x'), 16) || 0x22c55e;
  colorCache.set(colorStr, parsed);
  return parsed;
};
