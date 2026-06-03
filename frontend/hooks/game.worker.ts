import { decode } from "@msgpack/msgpack";
import { GameState, Player, Food, NetworkPlayer, NetworkPlayerUpdate } from "../types/game";

const ctx: Worker = self as any;

let socket: WebSocket | null = null;
let reconnectTimer: any = null;
let pingInterval: any = null;
let reconnectAttempt = 0;
let isCleaningUp = false;
let myId = "";

let gameState: GameState | null = null;
const foodMap = new Map<number, Food>();

function parsePoints(arr: any): { x: number; y: number }[] {
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

function connect(url: string) {
  if (isCleaningUp) return;

  socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";

  socket.onopen = () => {
    reconnectAttempt = 0;
    ctx.postMessage({ type: "STATUS", status: "connected", msg: "" });

    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(`PING:${Math.floor(performance.now())}`);
      }
    }, 2000);
  };

  socket.onclose = () => {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    ctx.postMessage({ type: "DISCONNECT" });

    if (isCleaningUp) return;

    reconnectAttempt += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 30000);
    ctx.postMessage({ 
      type: "STATUS", 
      status: "reconnecting", 
      msg: `Соединение потеряно. Переподключение через ${Math.ceil(delay / 1000)}с...` 
    });

    reconnectTimer = setTimeout(() => {
      connect(url);
    }, delay);
  };

  socket.onerror = () => {
    // onclose will handle this
  };

  socket.onmessage = (event) => {
    if (typeof event.data === "string") {
      if (event.data.startsWith("PONG:")) {
        const timestamp = parseFloat(event.data.substring(5));
        const latency = performance.now() - timestamp;
        ctx.postMessage({ type: "PING", latency });
      }
      return;
    }

    const parsedState = decode(new Uint8Array(event.data)) as any;
    if (parsedState.type === "SERVER_RESTART") {
      ctx.postMessage({ type: "STATUS", status: "reconnecting", msg: parsedState.message || "Сервер перезагружается..." });
      socket?.close(1000, "Server Restart");
      return;
    }

    if (parsedState.your_id) {
      myId = parsedState.your_id;
      ctx.postMessage({ type: "YOUR_ID", your_id: myId });
    }

    const mapW = parsedState.server_world?.width ?? 100;
    const mapH = parsedState.server_world?.height ?? 100;

    if (parsedState.type === "FULL" || !parsedState.type) {
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
      const initialFoods = (parsedState.foods || []).filter((f: any) => f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH);
      
      foodMap.clear();
      for (let i = 0; i < initialFoods.length; i++) {
        const f = initialFoods[i];
        foodMap.set(f.id, f);
      }

      gameState = {
        server_tick_rate: parsedState.server_tick_rate,
        server_world: parsedState.server_world,
        server_simulation: parsedState.server_simulation,
        server_snake: parsedState.server_snake,
        server_visual: parsedState.server_visual,
        server_food: parsedState.server_food,
        players,
        foods: initialFoods
      };
    } else if (parsedState.type === "DELTA") {
      if (!gameState) return;

      const currentPlayers = gameState.players || {};
      const nextPlayers: Record<string, Player> = {};

      for (const [pid, pData] of Object.entries(parsedState.players as Record<string, any>)) {
        const oldPlayer = currentPlayers[pid];
        const defaultPlayer = {
          body: [] as { x: number; y: number }[],
          angle: 0,
          score: 0,
          kills: 0,
          deaths: 0,
          nickname: "Игрок",
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

      for (const pid in currentPlayers) {
        if (!nextPlayers[pid] && !parsedState.players[pid]) {
          nextPlayers[pid] = currentPlayers[pid];
        }
      }

      if (parsedState.eaten_foods) {
        for (let i = 0; i < parsedState.eaten_foods.length; i++) {
          foodMap.delete(parsedState.eaten_foods[i]);
        }
      }

      const newFoodsFiltered: Food[] = [];
      if (parsedState.new_foods) {
        for (let i = 0; i < parsedState.new_foods.length; i++) {
          const nf = parsedState.new_foods[i] as Food;
          if (nf.x >= 0 && nf.x < mapW && nf.y >= 0 && nf.y < mapH) {
            newFoodsFiltered.push(nf);
            foodMap.set(nf.id, nf);
          }
        }
      }

      const eatenSet = new Set(parsedState.eaten_foods || []);
      const nextFoods = gameState.foods
        .filter((f) => !eatenSet.has(f.id) && f.x >= 0 && f.x < mapW && f.y >= 0 && f.y < mapH)
        .concat(newFoodsFiltered);

      const movedFoods = parsedState.moved_foods;
      if (movedFoods && movedFoods.length > 0) {
        for (let i = 0; i < movedFoods.length; i++) {
          const mf = movedFoods[i];
          const cachedFood = foodMap.get(mf.id);
          if (cachedFood && typeof mf.x === "number" && typeof mf.y === "number" && !isNaN(mf.x) && !isNaN(mf.y)) {
            cachedFood.x = mf.x;
            cachedFood.y = mf.y;
          }
        }
      }

      gameState = {
        server_tick_rate: parsedState.server_tick_rate ?? gameState.server_tick_rate,
        server_world: parsedState.server_world ?? gameState.server_world,
        server_simulation: parsedState.server_simulation ?? gameState.server_simulation,
        server_snake: parsedState.server_snake ?? gameState.server_snake,
        server_visual: parsedState.server_visual ?? gameState.server_visual,
        server_food: parsedState.server_food ?? gameState.server_food,
        players: nextPlayers,
        foods: nextFoods
      };
    }

    ctx.postMessage({
      type: "STATE",
      state: gameState,
      kill_events: parsedState.kill_events
    });
  };
}

function cleanup() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
}

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "CONNECT") {
    isCleaningUp = false;
    connect(msg.url);
  } else if (msg.type === "SEND") {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(msg.data);
    }
  } else if (msg.type === "CLOSE") {
    isCleaningUp = true;
    cleanup();
  }
};
