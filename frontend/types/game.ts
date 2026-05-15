export type ServerSimulationConfig = {
  tick_rate: number;
  base_speed_per_second: number;
  turn_speed_per_second: number;
  turn_idle_smoothing_at_20hz: number;
  turn_active_smoothing_at_20hz: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Food = {
  id: number;
  x: number;
  y: number;
  value: number;
};

export type Player = {
  body: Point[];
  angle: number;
  score: number;
  kills: number;
  deaths: number;
  accelerating?: boolean;
  skin?: string;
};

export type GameState = {
  server_tick_rate?: number;
  server_simulation?: ServerSimulationConfig;
  players: Record<string, Player>;
  foods: Food[];
};

export type PlayerUpdate = Partial<Omit<Player, "body">> & {
  body?: Point[];
  new_heads?: Point[];
  length?: number;
};

export type KillEvent = {
  killer: string | null;
  victim: string;
};

export type FullGameMessage = {
  type?: "FULL";
  server_tick_rate?: number;
  server_simulation?: ServerSimulationConfig;
  players: Record<string, Player>;
  foods: Food[];
  new_foods?: Food[];
  eaten_foods?: number[];
  kill_events?: KillEvent[];
};

export type DeltaGameMessage = {
  type: "DELTA";
  server_tick_rate?: number;
  server_simulation?: ServerSimulationConfig;
  players: Record<string, PlayerUpdate>;
  new_foods?: Food[];
  eaten_foods?: number[];
  kill_events?: KillEvent[];
};

export type ServerGameMessage = FullGameMessage | DeltaGameMessage;
