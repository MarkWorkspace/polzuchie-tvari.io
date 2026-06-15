// ROLE: Декодирование delta-стейтов с сервера. Не сеть, не интерполяция.

import type { GameState, Player, Food } from "../types/game";

export async function decompress(bytes: Uint8Array): Promise<ArrayBuffer> {
  const response = new Response(bytes as any);
  if (!response.body) throw new Error("Body is null");
  const decompressedStream = response.body.pipeThrough(new DecompressionStream("deflate"));
  return new Response(decompressedStream).arrayBuffer();
}

export function parsePoints(arr: any): { x: number; y: number }[] {
  if (!arr) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === 'number') {
    const points: { x: number; y: number }[] = [];
    const len = arr.length;
    for (let i = 0; i < len - 1; i += 2) {
      const px = arr[i];
      const py = arr[i+1];
      if (typeof px === 'number' && typeof py === 'number' && !isNaN(px) && !isNaN(py)) {
        points.push({ x: px, y: py });
      }
    }
    return points;
  }
  return arr;
}

export function decodeFullState(parsedState: any, mapW: number, mapH: number): GameState {
  const players: Record<string, Player> = {};
  if (parsedState.players) {
    for (const [pid, player] of Object.entries(parsedState.players)) {
      const netPlayer = player as any;
      players[pid] = {
        ...netPlayer,
        body: parsePoints(netPlayer.body),
      };
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

export function decodeDeltaState(
  parsedState: any,
  currentGameState: GameState,
  mapW: number,
  mapH: number
): GameState {
  const currentPlayers = currentGameState.players || {};
  const nextPlayers: Record<string, Player> = {};

  for (const [pid, pData] of Object.entries(parsedState.players as Record<string, any>)) {
    const oldPlayer = currentPlayers[pid];
    const defaultPlayer = {
      body: [] as { x: number; y: number }[],
      angle: 0,
      score: 0,
      kills: 0,
      deaths: 0,
      nickname: "",
      skin: "default"
    };
    const { body, new_heads, length, ...otherProps } = pData;
    let newBody: { x: number; y: number }[] = [];

    if (body) {
      newBody = parsePoints(body);
    } else if (oldPlayer && oldPlayer.body) {
      const addedHeads = parsePoints(new_heads);
      newBody = [...addedHeads, ...oldPlayer.body];
      const targetLen = length ?? oldPlayer.body.length;
      if (newBody.length > targetLen) {
        newBody = newBody.slice(0, targetLen);
      }
    }

    nextPlayers[pid] = {
      ...defaultPlayer,
      ...oldPlayer,
      ...otherProps,
      body: newBody,
    };
  }



  const newFoodsFiltered: Food[] = [];
  if (parsedState.new_foods) {
    for (let i = 0; i < parsedState.new_foods.length; i++) {
      const nf = parsedState.new_foods[i] as Food;
      if (nf.x >= 0 && nf.x < mapW && nf.y >= 0 && nf.y < mapH) {
        const nextFood = { ...nf };
        newFoodsFiltered.push(nextFood);
      }
    }
  }

  const eatenSet = new Set<number>(parsedState.eaten_foods || []);
  const movedFoodPositions = new Map<number, { x: number; y: number }>();
  const movedFoods = parsedState.moved_foods;
  if (movedFoods && movedFoods.length > 0) {
    for (let i = 0; i < movedFoods.length; i++) {
      const mf = movedFoods[i];
      if (typeof mf.id === "number" && typeof mf.x === "number" && typeof mf.y === "number" && !isNaN(mf.x) && !isNaN(mf.y)) {
        movedFoodPositions.set(mf.id, { x: mf.x, y: mf.y });
      }
    }
  }

  const nextFoods = currentGameState.foods
    .filter((f) => !eatenSet.has(f.id) && f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
    .map((f) => {
      const moved = movedFoodPositions.get(f.id);
      const nextFood = moved ? { ...f, x: moved.x, y: moved.y } : f;
      return nextFood;
    })
    .concat(newFoodsFiltered);

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
