// ROLE: Декодирование delta-стейтов с сервера. Не сеть, не интерполяция.

import type { GameState, Player, Food } from "../types/game";
import pako from "pako";

export function decompress(bytes: Uint8Array): Uint8Array {
  return pako.inflate(bytes);
}

export function ensureFlatArray(arr: any): number[] {
  if (!arr || arr.length === 0) return [];
  if (typeof arr[0] === 'number') {
    return arr as number[];
  }
  if (arr[0] && typeof arr[0] === 'object' && 'x' in arr[0]) {
    const res = new Array(arr.length * 2);
    for (let i = 0; i < arr.length; i++) {
      res[i * 2] = arr[i].x;
      res[i * 2 + 1] = arr[i].y;
    }
    return res;
  }
  return [];
}

function decodeFullPlayer(netPlayer: any): Player {
  return {
    angle: netPlayer.angle ?? 0,
    score: netPlayer.score ?? 0,
    kills: netPlayer.kills ?? 0,
    deaths: netPlayer.deaths ?? 0,
    accelerating: netPlayer.accelerating ?? false,
    is_dead: netPlayer.is_dead ?? false,
    teleport_state: netPlayer.teleport_state || "none",
    skin: netPlayer.skin || "default",
    nickname: netPlayer.nickname || "Игрок",
    ...netPlayer,
    body: ensureFlatArray(netPlayer.body),
  };
}

export function decodeFullState(parsedState: any, mapW: number, mapH: number): GameState {
  const players: Record<string, Player> = {};
  if (parsedState.players) {
    for (const [pid, player] of Object.entries(parsedState.players)) {
      players[pid] = decodeFullPlayer(player);
    }
  }
  const initialFoods = (parsedState.foods || [])
    .filter((f: any) => f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
    .map((f: Food) => ({ ...f }));

  return {
    server_tick_rate: parsedState.server_tick_rate,
    server_world: parsedState.server_world,
    server_simulation: parsedState.server_simulation,
    server_snake: parsedState.server_snake,
    server_visual: parsedState.server_visual,
    server_food: parsedState.server_food,
    players,
    foods: initialFoods,
    portals: parsedState.portals,
    black_holes: parsedState.black_holes,
    tombstones: parsedState.tombstones || []
  };
}

function getNewBody(
  body: any,
  new_heads: any,
  length: number | undefined,
  oldPlayer: Player | undefined
): number[] {
  if (body && body.length > 0) {
    return ensureFlatArray(body);
  }
  if (!oldPlayer || !oldPlayer.body) return [];
  const addedHeads = ensureFlatArray(new_heads);
  const targetLen = (length !== undefined && length !== 0) ? length : Math.floor(oldPlayer.body.length / 2);
  const newBody = new Array(targetLen * 2);
  const headsCount = addedHeads.length;
  for (let i = 0; i < headsCount && i < targetLen * 2; i++) {
    newBody[i] = addedHeads[i];
  }
  for (let i = headsCount; i < targetLen * 2; i++) {
    newBody[i] = oldPlayer.body[i - headsCount];
  }
  return newBody;
}

function decodePlayer(
  pData: any,
  oldPlayer: Player | undefined,
  defaultPlayer: any
): Player {
  const { body, new_heads, length, teleport_state, ...otherProps } = pData;
  const newBody = getNewBody(body, new_heads, length, oldPlayer);

  const cleanProps: Record<string, any> = {};
  for (const [k, v] of Object.entries(otherProps)) {
    if (v !== undefined) {
      cleanProps[k] = v;
    }
  }

  return {
    ...defaultPlayer,
    ...oldPlayer,
    teleport_state: teleport_state || "none",
    ...cleanProps,
    body: newBody,
  };
}

function decodePlayers(
  parsedPlayers: Record<string, any> | undefined,
  currentPlayers: Record<string, Player>
): Record<string, Player> {
  const nextPlayers: Record<string, Player> = {};
  if (!parsedPlayers) return nextPlayers;
  const defaultPlayer = {
    body: [] as number[],
    angle: 0,
    score: 0,
    kills: 0,
    deaths: 0,
    nickname: "",
    skin: "default"
  };
  for (const [pid, pData] of Object.entries(parsedPlayers)) {
    nextPlayers[pid] = decodePlayer(pData, currentPlayers[pid], defaultPlayer);
  }
  return nextPlayers;
}

function getNewFoodsFiltered(newFoods: any[] | undefined, mapW: number, mapH: number): Food[] {
  const filtered: Food[] = [];
  if (!newFoods) return filtered;
  for (let i = 0; i < newFoods.length; i++) {
    const nf = newFoods[i] as Food;
    if (nf.x >= 0 && nf.x < mapW && nf.y >= 0 && nf.y < mapH) {
      filtered.push({ ...nf });
    }
  }
  return filtered;
}

function getMovedFoodsMap(movedFoods: any[] | undefined): Map<number, { x: number; y: number }> {
  const movedMap = new Map<number, { x: number; y: number }>();
  if (!movedFoods) return movedMap;
  for (let i = 0; i < movedFoods.length; i++) {
    const mf = movedFoods[i];
    if (typeof mf.id === "number" && typeof mf.x === "number" && typeof mf.y === "number" && !isNaN(mf.x) && !isNaN(mf.y)) {
      movedMap.set(mf.id, { x: mf.x, y: mf.y });
    }
  }
  return movedMap;
}

function decodeFoods(
  currentFoods: Food[],
  eatenFoods: number[] | undefined,
  movedFoods: any[] | undefined,
  newFoods: any[] | undefined,
  mapW: number,
  mapH: number
): Food[] {
  const eatenSet = new Set<number>(eatenFoods || []);
  const movedMap = getMovedFoodsMap(movedFoods);
  const newFoodsFiltered = getNewFoodsFiltered(newFoods, mapW, mapH);

  return currentFoods
    .filter((f) => !eatenSet.has(f.id) && f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
    .map((f) => {
      const moved = movedMap.get(f.id);
      return moved ? { ...f, x: moved.x, y: moved.y } : f;
    })
    .concat(newFoodsFiltered);
}

export function decodeDeltaState(
  parsedState: any,
  currentGameState: GameState,
  mapW: number,
  mapH: number
): GameState {
  const nextPlayers = decodePlayers(parsedState.players, currentGameState.players || {});
  const nextFoods = decodeFoods(
    currentGameState.foods,
    parsedState.eaten_foods,
    parsedState.moved_foods,
    parsedState.new_foods,
    mapW,
    mapH
  );

  return {
    server_tick_rate: parsedState.server_tick_rate ?? currentGameState.server_tick_rate,
    server_world: parsedState.server_world ?? currentGameState.server_world,
    server_simulation: parsedState.server_simulation ?? currentGameState.server_simulation,
    server_snake: parsedState.server_snake ?? currentGameState.server_snake,
    server_visual: parsedState.server_visual ?? currentGameState.server_visual,
    server_food: parsedState.server_food ?? currentGameState.server_food,
    players: nextPlayers,
    foods: nextFoods,
    portals: parsedState.portals ?? currentGameState.portals,
    black_holes: parsedState.black_holes ?? currentGameState.black_holes,
    tombstones: parsedState.tombstones ?? currentGameState.tombstones ?? []
  };
}
