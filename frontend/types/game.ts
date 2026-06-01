export type ServerSimulationConfig = {
  tick_rate: number;
  base_speed_per_second: number;
  max_turn_speed_deg_per_second: number;
  min_turn_radius: number;
  turn_radius_thickness_coeff: number;
  turn_idle_smoothing_at_20hz: number;
  turn_active_smoothing_at_20hz: number;
};

export type ServerSnakeConfig = {
  base_head_radius: number;
  score_thickness_scale: number;
  camera_zoom_out_coeff: number;
  growth_score_per_segment: number;
  start_length: number;
  start_score: number;
  min_body_length: number;
  safe_spawn_distance: number;
};

export type ServerVisualConfig = {
  min_fog_radius: number;
  fog_score_expansion_coeff: number;
  camera_base_zoom: number;
  camera_pitch_angle: number;
  camera_z_height: number;
  camera_y_offset: number;
  mouse_sensitivity?: number;
};

export type ServerFoodConfig = {
  base_radius: number;
  radius_value_scale: number;
  death_drop_score_fraction: number;
  attraction_radius: number;
  attraction_speed: number;
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
  color: string;
};

export type Player = {
  body: Point[];
  angle: number;
  score: number;
  kills: number;
  deaths: number;
  accelerating?: boolean;
  skin?: string;
  nickname?: string;
};

export type GameState = {
  server_tick_rate?: number;
  server_simulation?: ServerSimulationConfig;
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
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
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
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
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
  players: Record<string, PlayerUpdate>;
  new_foods?: Food[];
  eaten_foods?: number[];
  moved_foods?: { id: number; x: number; y: number }[];
  kill_events?: KillEvent[];
};

export type ServerGameMessage = FullGameMessage | DeltaGameMessage;
