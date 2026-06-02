import { useEffect, useRef, useState, MutableRefObject } from "react";
import { DeltaGameMessage, GameState, Player, NetworkPlayerUpdate, Point, ServerGameMessage } from "../types/game";
import { decode } from "@msgpack/msgpack";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

function parsePoints(arr: any): Point[] {
  if (!arr) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === 'number') {
    const points: Point[] = [];
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
  return (arr as Point[]).filter(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number' && !isNaN(pt.x) && !isNaN(pt.y));
}

export function useGameSocket(
  nickname: string,
  skin: string,
  hasJoined: boolean,
  cameraModeRef: MutableRefObject<"2D" | "3D">,
  isMobile?: boolean
) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [statusMsg, setStatusMsg] = useState("");
  const [controlMode, setControlMode] = useState<"keyboard" | "mouse" | "tilt">("keyboard");
  const controlModeRef = useRef<"keyboard" | "mouse" | "tilt">("keyboard");
  const [leaderboard, setLeaderboard] = useState<{ id: string; score: number; kills: number; deaths: number; isMe: boolean }[]>([]);
  const [killFeed, setKillFeed] = useState<{ id: number; killer: string; victim: string; time: number }[]>([]);
  const [scoreFeed, setScoreFeed] = useState<{ id: number; delta: number; time: number }[]>([]);
  const [ping, setPing] = useState<number | null>(null);
  const [activePlayersCount, setActivePlayersCount] = useState<number>(0);

  const gameStateRef = useRef<GameState | null>(null);
  const lastGameStateRef = useRef<GameState | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const stateQueueRef = useRef<{ time: number; state: GameState }[]>([]);
  const myIdRef = useRef<string>("");
  const lastLeaderboardUpdateRef = useRef<number>(0);
  const localInputRef = useRef<{ turn: number; accelerating: boolean; touchX?: number | null; tiltX?: number | null }>({ turn: 0, accelerating: false, touchX: null, tiltX: null });
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCleaningUpRef = useRef(false);

  useEffect(() => {
    if (isMobile) {
      setControlMode("mouse");
      controlModeRef.current = "mouse";
    } else {
      setControlMode("keyboard");
      controlModeRef.current = "keyboard";
    }
  }, [isMobile]);

  useEffect(() => {
    if (!hasJoined) return;
    isCleaningUpRef.current = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const buildWsUrl = () => {
      const host = window.location.hostname || "127.0.0.1";
      const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
      const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
      const wsPort = isStandardPort ? "" : ":8000";
      const trimmedNickname = nickname.trim() || "Игрок";
      // Use trailing slash in the path to match Nginx location rule "/ws/" on production server
      return `${protocol}${host}${wsPort}/ws/?nickname=${encodeURIComponent(trimmedNickname)}&skin=${encodeURIComponent(skin)}`;
    };

    const connect = () => {
      if (isCleaningUpRef.current) return;
      
      const attempt = reconnectAttemptRef.current;
      if (attempt === 0) {
        setConnectionStatus("connecting");
        setStatusMsg("Подключение к серверу...");
      } else {
        setConnectionStatus("reconnecting");
        setStatusMsg(`Переподключение... (попытка ${attempt})`);
      }

      const socket = new WebSocket(buildWsUrl());
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("Подключено к серверу!");
        reconnectAttemptRef.current = 0;
        setConnectionStatus("connected");
        setStatusMsg(controlModeRef.current === "keyboard"
          ? "A/D/Стрелочки — рулить | Пробел — ускорение | C — камера | T — управление"
          : "Движение за курсором | Пробел — ускорение | C — камера | T — управление"
        );
        
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(`PING:${Math.floor(performance.now())}`);
          }
        }, 2000);
      };

      socket.onclose = (event) => {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        setPing(null);
        setActivePlayersCount(0);

        if (isCleaningUpRef.current) return;
        
        setConnectionStatus("reconnecting");
        
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
        reconnectAttemptRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 30000);
        setStatusMsg(`Соединение потеряно. Переподключение через ${Math.ceil(delay / 1000)}с...`);
        
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      socket.onerror = () => {
        // onclose will fire after this, which handles reconnection
      };

      socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          if (event.data.startsWith("PONG:")) {
            const timestamp = parseFloat(event.data.substring(5));
            const latency = performance.now() - timestamp;
            setPing(Math.round(latency));
          }
          return;
        }

        const parsedState = decode(new Uint8Array(event.data)) as any;
        if (parsedState.type === "SERVER_RESTART") {
          setConnectionStatus("reconnecting");
          setStatusMsg(parsedState.message || "Сервер перезагружается...");
          socket.close(1000, "Server Restart");
          return;
        }

        // Server assigns our ID on first FULL message
        if (parsedState.your_id) {
          myIdRef.current = parsedState.your_id;
        }

        lastGameStateRef.current = gameStateRef.current;

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
          gameStateRef.current = {
            server_tick_rate: parsedState.server_tick_rate,
            server_simulation: parsedState.server_simulation,
            server_snake: parsedState.server_snake,
            server_visual: parsedState.server_visual,
            server_food: parsedState.server_food,
            players,
            foods: parsedState.foods || [],
          };
          // Clear interpolation queue on full state to prevent glitches
          stateQueueRef.current = [];
        } else if (parsedState.type === "DELTA") {
          if (!gameStateRef.current) return;
          
          const eatenSet = new Set(parsedState.eaten_foods || []);
          const nextFoods = gameStateRef.current.foods
            .filter((f) => !eatenSet.has(f.id))
            .concat(parsedState.new_foods || []);

          const movedFoods = (parsedState as DeltaGameMessage).moved_foods;
          if (movedFoods && movedFoods.length > 0) {
            const foodIndex = new Map<number, number>();
            for (let i = 0; i < nextFoods.length; i++) foodIndex.set(nextFoods[i].id, i);
            for (const mf of movedFoods) {
              const idx = foodIndex.get(mf.id);
              if (idx !== undefined && typeof mf.x === "number" && typeof mf.y === "number" && !isNaN(mf.x) && !isNaN(mf.y)) {
                nextFoods[idx] = { ...nextFoods[idx], x: mf.x, y: mf.y };
              }
            }
          }

          const currentPlayers = gameStateRef.current.players || {};
          const nextPlayers: Record<string, Player> = {};
          
          for (const [pid, pData] of Object.entries((parsedState as DeltaGameMessage).players as Record<string, NetworkPlayerUpdate>)) {
            const oldPlayer = currentPlayers[pid];
            let newBody: Point[] = [];
            
            if (pData.body) {
              newBody = parsePoints(pData.body);
            } else if (oldPlayer && oldPlayer.body) {
              newBody = [...oldPlayer.body];
              if (pData.new_heads && pData.new_heads.length > 0) {
                newBody.unshift(...parsePoints(pData.new_heads));
              }
              if (pData.length !== undefined) {
                while (newBody.length > pData.length) {
                  newBody.pop();
                }
              }
            } else {
              if (pData.new_heads && pData.new_heads.length > 0) {
                newBody = parsePoints(pData.new_heads);
              }
            }
            
            const defaultPlayer: Player = {
              angle: 0,
              score: 0,
              kills: 0,
              deaths: 0,
              body: [],
            };

            const { body: _body, new_heads: _new_heads, length: _length, ...otherProps } = pData;
            nextPlayers[pid] = {
              ...defaultPlayer,
              ...oldPlayer,
              ...(otherProps as any),
              body: newBody,
            };
          }

          gameStateRef.current = {
            ...gameStateRef.current,
            server_tick_rate: parsedState.server_tick_rate ?? gameStateRef.current.server_tick_rate,
            server_simulation: parsedState.server_simulation ?? gameStateRef.current.server_simulation,
            server_snake: parsedState.server_snake ?? gameStateRef.current.server_snake,
            server_visual: parsedState.server_visual ?? gameStateRef.current.server_visual,
            server_food: parsedState.server_food ?? gameStateRef.current.server_food,
            players: nextPlayers,
            foods: nextFoods
          };

          // Обработка событий для UI
          const myOldPlayer = currentPlayers[myIdRef.current];
          const myNewPlayer = nextPlayers[myIdRef.current];
          if (myOldPlayer && myNewPlayer) {
            const delta = myNewPlayer.score - myOldPlayer.score;
            if (delta > 0 || delta < -1) {
              setScoreFeed(prev => [...prev, { id: Date.now() + Math.random(), delta, time: Date.now() }].slice(-3));
            }
          }

          if (parsedState.kill_events && parsedState.kill_events.length > 0) {
            const extractName = (id: string) => {
              if (!id) return "Стена";
              // Look up nickname from game state
              const player = gameStateRef.current?.players[id];
              return player?.nickname || id;
            };
            
            const newKills = parsedState.kill_events.map((e: any) => ({
              id: Date.now() + Math.random(),
              killer: extractName(e.killer || ""),
              victim: extractName(e.victim),
              time: Date.now()
            }));
            setKillFeed(prev => [...prev, ...newKills].slice(-5));
          }
        }

        lastUpdateTimeRef.current = performance.now();

        if (gameStateRef.current) {
          stateQueueRef.current.push({
            time: lastUpdateTimeRef.current,
            state: gameStateRef.current,
          });
          if (stateQueueRef.current.length > 20) {
            stateQueueRef.current.shift();
          }
        }

        const playersSource = gameStateRef.current?.players;
        if (playersSource && performance.now() - lastLeaderboardUpdateRef.current > 500) {
          const board = Object.entries(playersSource)
            .map(([playerId, p]) => ({
              id: playerId,
              nickname: p.nickname || "Игрок",
              score: p.score || 0,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              isMe: playerId === myIdRef.current,
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          setLeaderboard(board);
          setActivePlayersCount(Object.keys(playersSource).length);
          lastLeaderboardUpdateRef.current = performance.now();
        }
      };
    };

    connect();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === "KeyC") {
        cameraModeRef.current = cameraModeRef.current === "2D" ? "3D" : "2D";
        return;
      }

      const sock = socketRef.current;

      if (e.code === "KeyT") {
        const next = controlModeRef.current === "keyboard" ? "mouse" : "keyboard";
        controlModeRef.current = next;
        setControlMode(next);

        // Reset turn state on mode toggle
        if (sock && sock.readyState === WebSocket.OPEN) {
          if (localInputRef.current.turn === -1) sock.send("LEFT_UP");
          if (localInputRef.current.turn === 1) sock.send("RIGHT_UP");
        }
        localInputRef.current.turn = 0;

        setStatusMsg(next === "keyboard"
          ? "A/D/Стрелочки — рулить | Пробел — ускорение | C — камера | T — управление"
          : "Движение за курсором | Пробел — ускорение | C — камера | T — управление"
        );
        return;
      }
      
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      
      if (controlModeRef.current === "keyboard") {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          if (localInputRef.current.turn !== -1) {
            sock.send("LEFT_DOWN");
            localInputRef.current.turn = -1;
          }
        }
        if (e.code === "ArrowRight" || e.code === "KeyD") {
          if (localInputRef.current.turn !== 1) {
            sock.send("RIGHT_DOWN");
            localInputRef.current.turn = 1;
          }
        }
      }
      
      if (e.code === "Space") {
        if (!localInputRef.current.accelerating) {
          sock.send("SPACE_DOWN");
          localInputRef.current.accelerating = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const sock = socketRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
      
      if (controlModeRef.current === "keyboard") {
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          sock.send("LEFT_UP");
          if (localInputRef.current.turn === -1) localInputRef.current.turn = 0;
        }
        if (e.code === "ArrowRight" || e.code === "KeyD") {
          sock.send("RIGHT_UP");
          if (localInputRef.current.turn === 1) localInputRef.current.turn = 0;
        }
      }
      
      if (e.code === "Space") {
        sock.send("SPACE_UP");
        localInputRef.current.accelerating = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      isCleaningUpRef.current = true;
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [hasJoined, nickname, skin, cameraModeRef]);

  // Очистка старых событий из логов
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setKillFeed(prev => prev.filter(k => now - k.time < 5000));
      setScoreFeed(prev => prev.filter(s => now - s.time < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected: connectionStatus === "connected",
    connectionStatus,
    statusMsg,
    leaderboard,
    killFeed,
    scoreFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    stateQueueRef,
    myIdRef,
    localInputRef,
    ping,
    activePlayersCount,
    controlMode,
    controlModeRef,
    setControlMode,
    socketRef
  };
}
