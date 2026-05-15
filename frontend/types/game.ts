export type GameState = {
  players: Record<string, { body: { x: number; y: number }[]; angle: number; score: number; kills: number; deaths: number; accelerating?: boolean }>;
  foods: { x: number; y: number; value: number }[];
};