// ROLE: Personal best persistence and comparison. No UI or network.
export interface RunStats {
  score: number;
  length: number;
  kills: number;
}

export interface PersonalBest extends RunStats {}

const STORAGE_KEY = "snake-personal-best";
const EMPTY_BEST: PersonalBest = { score: 0, length: 0, kills: 0 };

type BestStorage = Pick<Storage, "getItem" | "setItem">;

function sanitizeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function sanitizeBest(value: unknown): PersonalBest {
  if (!value || typeof value !== "object") return { ...EMPTY_BEST };
  const record = value as Record<string, unknown>;
  return {
    score: sanitizeNumber(record.score),
    length: sanitizeNumber(record.length),
    kills: sanitizeNumber(record.kills),
  };
}

export function loadPersonalBest(storage: BestStorage = localStorage): PersonalBest {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? sanitizeBest(JSON.parse(raw)) : { ...EMPTY_BEST };
  } catch {
    return { ...EMPTY_BEST };
  }
}

export function updatePersonalBest(
  stats: RunStats,
  storage: BestStorage = localStorage,
): { best: PersonalBest; isNewRecord: boolean } {
  const previous = loadPersonalBest(storage);
  const normalized: RunStats = {
    score: sanitizeNumber(stats.score),
    length: sanitizeNumber(stats.length),
    kills: sanitizeNumber(stats.kills),
  };
  const isNewRecord = normalized.score > previous.score;
  const best: PersonalBest = {
    score: Math.max(previous.score, normalized.score),
    length: Math.max(previous.length, normalized.length),
    kills: Math.max(previous.kills, normalized.kills),
  };

  if (
    best.score !== previous.score ||
    best.length !== previous.length ||
    best.kills !== previous.kills
  ) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(best));
    } catch {
      // Quota/private-mode failures must not break the death overlay.
    }
  }

  return { best, isNewRecord };
}
