// ROLE: Минимальный Protobuf-декодер GameStateFrame для воркера. Не генерирует и не кодирует сообщения.

type FieldType = "int32" | "float" | "string" | "bool";
type FieldSpec = Record<number, [string, FieldType]>;

type Reader = {
  bytes: Uint8Array;
  view: DataView;
  pos: number;
  end: number;
};

const FRAME_TYPES = ["UNKNOWN", "FULL", "DELTA", "SERVER_RESTART"];
const TEXT_DECODER = new TextDecoder();

const WORLD_CONFIG: FieldSpec = {
  1: ["width", "int32"], 2: ["height", "int32"], 3: ["portals_enabled", "int32"],
  4: ["portals_count", "int32"], 5: ["portals_radius", "float"],
  6: ["portals_teleport_delay_ms", "int32"], 7: ["portals_spawn_chance", "float"],
  8: ["portals_growth_time", "float"], 9: ["black_holes_enabled", "int32"],
  10: ["black_holes_count", "int32"], 11: ["black_holes_spawn_chance", "float"],
  12: ["black_holes_pull_radius", "float"], 13: ["black_holes_pull_force", "float"],
  14: ["black_holes_kill_radius", "float"], 15: ["black_holes_growth_time", "float"]
};

const SIM_CONFIG: FieldSpec = {
  1: ["tick_rate", "int32"], 2: ["base_speed_per_second", "float"],
  3: ["max_turn_speed_deg_per_second", "float"], 4: ["min_turn_radius", "float"],
  5: ["turn_radius_thickness_coeff", "float"],
  6: ["turn_idle_smoothing_at_20hz", "float"],
  7: ["turn_active_smoothing_at_20hz", "float"]
};

const SNAKE_CONFIG: FieldSpec = {
  1: ["base_head_radius", "float"], 2: ["score_thickness_scale", "float"],
  3: ["camera_zoom_out_coeff", "float"], 4: ["growth_score_per_segment", "string"],
  5: ["start_length", "int32"], 6: ["start_score", "int32"],
  7: ["min_body_length", "int32"], 8: ["safe_spawn_distance", "float"],
  9: ["max_growth_score", "int32"]
};

const VISUAL_CONFIG: FieldSpec = {
  1: ["min_fog_radius", "float"], 2: ["fog_score_expansion_coeff", "float"],
  3: ["camera_base_zoom", "float"], 4: ["camera_pitch_angle", "float"],
  5: ["camera_z_height", "float"], 6: ["camera_y_offset", "float"],
  7: ["mouse_sensitivity", "float"], 8: ["head_glow_radius", "float"]
};

const FOOD_TYPE_CONFIG: FieldSpec = {
  1: ["value", "int32"], 2: ["weight", "int32"],
  3: ["color", "string"], 4: ["image", "string"]
};

const FOOD_CONFIG: FieldSpec = {
  2: ["base_radius", "float"], 3: ["radius_value_scale", "float"],
  4: ["death_drop_score_fraction", "float"],
  5: ["attraction_radius", "float"], 6: ["attraction_speed", "float"]
};

const FOOD: FieldSpec = {
  1: ["id", "int32"], 2: ["x", "float"], 3: ["y", "float"],
  4: ["value", "int32"], 5: ["color", "string"], 6: ["image", "string"]
};

const MOVED_FOOD: FieldSpec = {
  1: ["id", "int32"], 2: ["x", "float"], 3: ["y", "float"]
};

const PORTAL: FieldSpec = {
  1: ["id", "string"], 2: ["color", "string"], 3: ["x1", "float"],
  4: ["y1", "float"], 5: ["x2", "float"], 6: ["y2", "float"],
  7: ["radius", "float"], 8: ["current_scale", "float"]
};

const BLACK_HOLE: FieldSpec = {
  1: ["id", "string"], 2: ["x", "float"], 3: ["y", "float"],
  4: ["pull_radius", "float"], 5: ["kill_radius", "float"]
};

const TOMBSTONE: FieldSpec = {
  1: ["id", "string"], 2: ["x", "float"], 3: ["y", "float"],
  4: ["nickname", "string"], 5: ["time_left", "float"]
};

const KILL_EVENT: FieldSpec = {
  1: ["killer", "string"], 2: ["victim", "string"]
};

const PLAYER: FieldSpec = {
  1: ["angle", "float"], 2: ["score", "int32"], 3: ["kills", "int32"],
  4: ["deaths", "int32"], 5: ["accelerating", "bool"], 6: ["is_dead", "bool"],
  7: ["teleport_state", "string"], 8: ["teleport_out_x", "float"],
  9: ["teleport_out_y", "float"], 10: ["teleport_timer_ratio", "float"],
  11: ["skin", "string"], 12: ["nickname", "string"], 15: ["length", "int32"]
};

function makeReader(bytes: Uint8Array, start = 0, end = bytes.length): Reader {
  return { bytes, view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), pos: start, end };
}

function readVarint(r: Reader): number {
  let value = 0;
  let shift = 0;
  while (r.pos < r.end) {
    const b = r.bytes[r.pos++];
    value += (b & 0x7f) * 2 ** shift;
    if (b < 0x80) return value;
    shift += 7;
  }
  throw new Error("Truncated varint");
}

function readFloat(r: Reader): number {
  const value = r.view.getFloat32(r.pos, true);
  r.pos += 4;
  return value;
}

function readBytes(r: Reader): Uint8Array {
  const len = readVarint(r);
  const start = r.pos;
  r.pos += len;
  return r.bytes.subarray(start, r.pos);
}

function readString(r: Reader): string {
  return TEXT_DECODER.decode(readBytes(r));
}

function readScalar(r: Reader, type: FieldType): number | string | boolean {
  if (type === "float") return readFloat(r);
  if (type === "string") return readString(r);
  if (type === "bool") return readVarint(r) !== 0;
  return readVarint(r) | 0;
}

function skipField(r: Reader, wire: number): void {
  if (wire === 0) { readVarint(r); return; }
  if (wire === 1) { r.pos += 8; return; }
  if (wire === 2) { r.pos += readVarint(r); return; }
  if (wire === 5) { r.pos += 4; return; }
  throw new Error(`Unsupported wire type ${wire}`);
}

function decodeScalarMessage(bytes: Uint8Array, schema: FieldSpec): Record<string, any> {
  const r = makeReader(bytes);
  const out: Record<string, any> = {};
  while (r.pos < r.end) {
    const tag = readVarint(r);
    const spec = schema[tag >>> 3];
    if (!spec) { skipField(r, tag & 7); continue; }
    out[spec[0]] = readScalar(r, spec[1]);
  }
  return out;
}

function decodePackedFloats(bytes: Uint8Array): number[] {
  const r = makeReader(bytes);
  const values: number[] = [];
  while (r.pos < r.end) values.push(readFloat(r));
  return values;
}

function decodePackedInts(bytes: Uint8Array): number[] {
  const r = makeReader(bytes);
  const values: number[] = [];
  while (r.pos < r.end) values.push(readVarint(r) | 0);
  return values;
}

function decodePlayer(bytes: Uint8Array): Record<string, any> {
  const r = makeReader(bytes);
  const out: Record<string, any> = {};
  while (r.pos < r.end) decodePlayerField(r, out);
  return out;
}

function decodePlayerField(r: Reader, out: Record<string, any>): void {
  const tag = readVarint(r);
  const field = tag >>> 3;
  const wire = tag & 7;
  if (field === 13 || field === 14) {
    const key = field === 13 ? "body" : "new_heads";
    out[key] = wire === 2 ? decodePackedFloats(readBytes(r)) : appendFloat(out[key], r);
    return;
  }
  const spec = PLAYER[field];
  if (!spec) { skipField(r, wire); return; }
  out[spec[0]] = readScalar(r, spec[1]);
}

function appendFloat(existing: number[] | undefined, r: Reader): number[] {
  const values = existing || [];
  values.push(readFloat(r));
  return values;
}

function decodePlayersEntry(bytes: Uint8Array): [string, Record<string, any>] {
  const r = makeReader(bytes);
  let key = "";
  let value: Record<string, any> = {};
  while (r.pos < r.end) {
    const tag = readVarint(r);
    if ((tag >>> 3) === 1) key = readString(r);
    else if ((tag >>> 3) === 2) value = decodePlayer(readBytes(r));
    else skipField(r, tag & 7);
  }
  return [key, value];
}

function decodeFoodConfig(bytes: Uint8Array): Record<string, any> {
  const r = makeReader(bytes);
  const out: Record<string, any> = {};
  while (r.pos < r.end) {
    const tag = readVarint(r);
    if ((tag >>> 3) === 1) (out.types ||= []).push(decodeScalarMessage(readBytes(r), FOOD_TYPE_CONFIG));
    else decodeSchemaField(r, out, tag, FOOD_CONFIG);
  }
  return out;
}

function decodeSchemaField(r: Reader, out: Record<string, any>, tag: number, schema: FieldSpec): void {
  const spec = schema[tag >>> 3];
  if (!spec) { skipField(r, tag & 7); return; }
  out[spec[0]] = readScalar(r, spec[1]);
}

function pushMessage(
  frame: Record<string, any>,
  key: string,
  r: Reader,
  decoder: (bytes: Uint8Array) => Record<string, any>
): void {
  (frame[key] ||= []).push(decoder(readBytes(r)));
}

function decodeFrameField(r: Reader, frame: Record<string, any>): void {
  const tag = readVarint(r);
  const field = tag >>> 3;
  if (field === 1) frame.type = FRAME_TYPES[readVarint(r)] || "UNKNOWN";
  else if (field === 2) frame.server_tick_rate = readVarint(r) | 0;
  else if (field === 3) { const [k, v] = decodePlayersEntry(readBytes(r)); (frame.players ||= {})[k] = v; }
  else if (field === 4) pushMessage(frame, "foods", r, b => decodeScalarMessage(b, FOOD));
  else if (field === 5) pushMessage(frame, "new_foods", r, b => decodeScalarMessage(b, FOOD));
  else if (field === 6) frame.eaten_foods = decodeEatenFoods(r, tag & 7, frame.eaten_foods);
  else if (field === 7) pushMessage(frame, "moved_foods", r, b => decodeScalarMessage(b, MOVED_FOOD));
  else decodeFrameFieldExtended(r, frame, tag);
}

function decodeFrameFieldExtended(r: Reader, frame: Record<string, any>, tag: number): void {
  const field = tag >>> 3;
  if (field === 8) pushMessage(frame, "kill_events", r, b => decodeScalarMessage(b, KILL_EVENT));
  else if (field === 9) pushMessage(frame, "tombstones", r, b => decodeScalarMessage(b, TOMBSTONE));
  else if (field === 10) pushMessage(frame, "portals", r, b => decodeScalarMessage(b, PORTAL));
  else if (field === 11) pushMessage(frame, "black_holes", r, b => decodeScalarMessage(b, BLACK_HOLE));
  else if (field === 12) frame.server_world = decodeScalarMessage(readBytes(r), WORLD_CONFIG);
  else if (field === 13) frame.server_simulation = decodeScalarMessage(readBytes(r), SIM_CONFIG);
  else if (field === 14) frame.server_snake = decodeScalarMessage(readBytes(r), SNAKE_CONFIG);
  else if (field === 15) frame.server_visual = decodeScalarMessage(readBytes(r), VISUAL_CONFIG);
  else if (field === 16) frame.server_food = decodeFoodConfig(readBytes(r));
  else if (field === 17) frame.your_id = readString(r);
  else if (field === 18) frame.restart_message = readString(r);
  else skipField(r, tag & 7);
}

function decodeEatenFoods(r: Reader, wire: number, existing: number[] | undefined): number[] {
  const values = existing || [];
  if (wire === 2) values.push(...decodePackedInts(readBytes(r)));
  else values.push(readVarint(r) | 0);
  return values;
}

export function decodeGameStateFrame(bytes: Uint8Array): Record<string, any> {
  const r = makeReader(bytes);
  const frame: Record<string, any> = {};
  while (r.pos < r.end) decodeFrameField(r, frame);
  return frame;
}
