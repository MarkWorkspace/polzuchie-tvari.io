// ROLE: Pure projection of worker player snapshots into spectator leaderboard rows. Not networking or rendering.

export interface SpectatorLeaderboardEntry {
  id: string;
  nickname?: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
}

interface LightweightPlayer {
  nickname?: string;
  score?: number;
  kills?: number;
  deaths?: number;
}

/**
 * The worker sends players as a map keyed by client id and does not repeat the
 * id inside each player object, so derive it from the map key.
 */
export function buildSpectatorLeaderboard(
  players: Record<string, LightweightPlayer | undefined>,
  limit = 10,
): SpectatorLeaderboardEntry[] {
  return Object.entries(players)
    .filter(([, player]) => Boolean(player))
    .map(([id, player]) => ({
      id,
      nickname: player?.nickname,
      score: Math.floor(player?.score ?? 0),
      kills: player?.kills ?? 0,
      deaths: player?.deaths ?? 0,
      isMe: false,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
