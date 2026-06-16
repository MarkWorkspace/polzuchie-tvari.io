// ROLE: Типы GameState, Player, Food и др. Только типы, без логики.

export type ServerWorldConfig = {
  width: number;
  height: number;
  portals_enabled?: number;
  portals_count?: number;
  portals_radius?: number;
  portals_teleport_delay_ms?: number;
  portals_spawn_chance?: number;
  portals_growth_time?: number;
  black_holes_enabled?: number;
  black_holes_count?: number;
  black_holes_spawn_chance?: number;
  black_holes_pull_radius?: number;
  black_holes_pull_force?: number;
  black_holes_kill_radius?: number;
  black_holes_growth_time?: number;
};

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
  growth_score_per_segment: number | string;
  start_length: number;
  start_score: number;
  min_body_length: number;
  safe_spawn_distance: number;
  max_growth_score: number;
};

export interface ServerVisualConfig {
  min_fog_radius?: number;
  fog_score_expansion_coeff?: number;
  camera_base_zoom?: number;
  camera_pitch_angle?: number;
  camera_z_height?: number;
  camera_y_offset?: number;
  mouse_sensitivity?: number;
  head_glow_radius?: number;
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
  image?: string;
  radius?: number;
  eaten?: boolean;
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
  teleport_state?: string;
  teleport_out_x?: number;
  teleport_out_y?: number;
  teleport_timer_ratio?: number;
  speed_mult?: number;
  is_dead?: boolean;
};

export type Portal = {
  id: number;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius: number;
  state?: string;
  current_scale?: number;
};

export type BlackHole = {
  id: string;
  x: number;
  y: number;
  pull_radius: number;
  kill_radius: number;
  state?: string;
  current_scale?: number;
};

export type Tombstone = {
  id: string;
  x: number;
  y: number;
  nickname: string;
  time_left: number;
};

export type GameState = {
  server_tick_rate?: number;
  server_world?: ServerWorldConfig;
  server_simulation?: ServerSimulationConfig;
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
  server_boost?: any;
  players: Record<string, Player>;
  foods: Food[];
  portals?: Portal[];
  black_holes?: BlackHole[];
  tombstones?: Tombstone[];
};

export type NetworkPlayer = Omit<Player, "body"> & {
  body: Point[] | number[];
  teleport_state?: string;
  teleport_out_x?: number;
  teleport_out_y?: number;
  teleport_timer_ratio?: number;
};

export type NetworkPlayerUpdate = Partial<Omit<Player, "body">> & {
  body?: Point[] | number[];
  new_heads?: Point[] | number[];
  length?: number;
  teleport_state?: string;
  teleport_out_x?: number;
  teleport_out_y?: number;
  teleport_timer_ratio?: number;
};

export type KillEvent = {
  killer: string | null;
  victim: string;
};

export type FullGameMessage = {
  type?: "FULL";
  server_tick_rate?: number;
  server_world?: ServerWorldConfig;
  server_simulation?: ServerSimulationConfig;
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
  server_boost?: any;
  players: Record<string, NetworkPlayer>;
  foods: Food[];
  new_foods?: Food[];
  eaten_foods?: number[];
  kill_events?: KillEvent[];
  your_id?: string;
  portals?: Portal[];
  black_holes?: BlackHole[];
  tombstones?: Tombstone[];
};

export type DeltaGameMessage = {
  type: "DELTA";
  server_tick_rate?: number;
  server_world?: ServerWorldConfig;
  server_simulation?: ServerSimulationConfig;
  server_snake?: ServerSnakeConfig;
  server_visual?: ServerVisualConfig;
  server_food?: ServerFoodConfig;
  server_boost?: any;
  players: Record<string, NetworkPlayerUpdate>;
  new_foods?: Food[];
  eaten_foods?: number[];
  moved_foods?: { id: number; x: number; y: number }[];
  kill_events?: KillEvent[];
  portals?: Portal[];
  black_holes?: BlackHole[];
  tombstones?: Tombstone[];
};

export type ServerGameMessage = FullGameMessage | DeltaGameMessage;
