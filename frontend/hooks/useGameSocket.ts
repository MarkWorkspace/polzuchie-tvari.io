import { useEffect, useRef, useState, MutableRefObject } from "react";
import { DeltaGameMessage, GameState, Player, PlayerUpdate, Point, ServerGameMessage } from "../types/game";
import { decode } from "@msgpack/msgpack";

export function useGameSocket(
  nickname: string,
  skin: string,
  hasJoined: boolean,
  cameraModeRef: MutableRefObject<"2D" | "3D">
) {
  const [isConnected, setIsConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [leaderboard, setLeaderboard] = useState<{ id: string; score: number; kills: number; deaths: number; isMe: boolean }[]>([]);
  const [killFeed, setKillFeed] = useState<{ id: number; killer: string; victim: string; time: number }[]>([]);
  const [scoreFeed, setScoreFeed] = useState<{ id: number; delta: number; time: number }[]>([]);

  const gameStateRef = useRef<GameState | null>(null);
  const lastGameStateRef = useRef<GameState | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const myIdRef = useRef<string>("");
  const lastLeaderboardUpdateRef = useRef<number>(0);
  const localInputRef = useRef({ turn: 0, accelerating: false });

  useEffect(() => {
    if (!hasJoined) return;

    const id = `${nickname.trim() || "Игрок"}_${Math.random().toString(36).substring(2, 9)}`;
    myIdRef.current = id;
    
    const host = window.location.hostname || "127.0.0.1";
    const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
    
    // В проде обращаемся без порта (через Nginx: 443/80), в дев-режиме стучимся на :8000
    const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
    const wsPort = isStandardPort ? "" : ":8000";
    
    const socket = new WebSocket(`${protocol}${host}${wsPort}/ws/${encodeURIComponent(id)}?skin=${encodeURIComponent(skin)}`);
    socket.binaryType = "arraybuffer";

    socket.onopen = () => {
      console.log("Подключено к серверу!");
      setIsConnected(true);
      setStatusMsg("A/D/Стрелочки — рулить | Пробел — ускорение | C — камера");
    };

    socket.onclose = () => {
      setIsConnected(false);
      setStatusMsg("Отключено от сервера. Перезагрузите страницу.");
    };

    socket.onerror = (error) => {
      console.error("Ошибка WebSocket:", error);
      setStatusMsg("Ошибка! Возможно, брандмауэр блокирует порт 8000.");
    };

    socket.onmessage = (event) => {
      const parsedState = decode(new Uint8Array(event.data)) as ServerGameMessage;
      
      lastGameStateRef.current = gameStateRef.current;

      if (parsedState.type === "FULL" || !parsedState.type) {
        gameStateRef.current = {
          server_tick_rate: parsedState.server_tick_rate,
          server_simulation: parsedState.server_simulation,
          players: parsedState.players,
          foods: parsedState.foods,
        };
      } else if (parsedState.type === "DELTA") {
        if (!gameStateRef.current) return; // Ждем FULL_STATE
        
        const eatenSet = new Set(parsedState.eaten_foods || []);
        // Убираем съеденное, добавляем новое
        const nextFoods = gameStateRef.current.foods
          .filter((f) => !eatenSet.has(f.id))
          .concat(parsedState.new_foods || []);
          
        const currentPlayers = gameStateRef.current.players || {};
        const nextPlayers: Record<string, Player> = {};
        
        for (const [pid, pData] of Object.entries((parsedState as DeltaGameMessage).players as Record<string, PlayerUpdate>)) {
          const oldPlayer = currentPlayers[pid];
          let newBody: Point[] = [];
          
          if (pData.body) {
            // Сервер прислал полное тело (FULL или игрок возродился)
            newBody = pData.body;
          } else if (oldPlayer && oldPlayer.body) {
            // Дельта: Добавляем в массив новые головы, присланные сервером
            newBody = [...oldPlayer.body];
            if (pData.new_heads && pData.new_heads.length > 0) {
              newBody.unshift(...pData.new_heads);
            }
            // Удаляем хвост до целевой длины (команда удаления)
            if (pData.length !== undefined) {
              while (newBody.length > pData.length) {
                newBody.pop();
              }
            }
          } else {
            // Игрок впервые вошел в AoI, но у нас есть только новые головы
            if (pData.new_heads && pData.new_heads.length > 0) {
              newBody = [...pData.new_heads];
            }
          }
          
          const defaultPlayer: Player = {
            angle: 0,
            score: 0,
            kills: 0,
            deaths: 0,
            body: [],
          };

          nextPlayers[pid] = {
            ...defaultPlayer,
            ...oldPlayer,
            ...pData,
            body: newBody,
          };
        }

        gameStateRef.current = {
          ...gameStateRef.current,
          server_tick_rate: parsedState.server_tick_rate ?? gameStateRef.current.server_tick_rate,
          server_simulation: parsedState.server_simulation ?? gameStateRef.current.server_simulation,
          players: nextPlayers,
          foods: nextFoods
        };

        // Обработка событий для UI
        const myOldPlayer = currentPlayers[myIdRef.current];
        const myNewPlayer = nextPlayers[myIdRef.current];
        if (myOldPlayer && myNewPlayer) {
          const delta = myNewPlayer.score - myOldPlayer.score;
          // Игнорируем дельту -1, так как это просто потеря очков от ускорения
          if (delta > 0 || delta < -1) {
            setScoreFeed(prev => [...prev, { id: Date.now() + Math.random(), delta, time: Date.now() }].slice(-5));
          }
        }

        if (parsedState.kill_events && parsedState.kill_events.length > 0) {
          const extractName = (id: string) => (!id ? "Стена" : id.split('_').slice(0, -1).join('_') || id);
          
          const newKills = parsedState.kill_events.map((e) => ({
            id: Date.now() + Math.random(),
            killer: extractName(e.killer || ""),
            victim: extractName(e.victim),
            time: Date.now()
          }));
          setKillFeed(prev => [...prev, ...newKills].slice(-5));
        }
      }

      lastUpdateTimeRef.current = performance.now();

      const playersSource = gameStateRef.current?.players;
      // Обновляем React-стейт лидерборда не чаще 2 раз в секунду, чтобы избежать фризов
      if (playersSource && performance.now() - lastLeaderboardUpdateRef.current > 500) {
        const board = Object.entries(playersSource)
          .map(([playerId, p]) => ({
            id: playerId,
            score: p.score || 0,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            isMe: playerId === myIdRef.current,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        setLeaderboard(board);
        lastLeaderboardUpdateRef.current = performance.now();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Предотвращаем скроллинг страницы пробелом или стрелочками
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === "KeyC") {
        cameraModeRef.current = cameraModeRef.current === "2D" ? "3D" : "2D";
        return;
      }
      if (socket.readyState !== WebSocket.OPEN) return;
      
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        if (localInputRef.current.turn !== -1) {
          socket.send("LEFT_DOWN");
          localInputRef.current.turn = -1;
        }
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        if (localInputRef.current.turn !== 1) {
          socket.send("RIGHT_DOWN");
          localInputRef.current.turn = 1;
        }
      }
      if (e.code === "Space") {
        if (!localInputRef.current.accelerating) {
          socket.send("SPACE_DOWN");
          localInputRef.current.accelerating = true;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        socket.send("LEFT_UP");
        if (localInputRef.current.turn === -1) localInputRef.current.turn = 0;
      }
      if (e.code === "ArrowRight" || e.code === "KeyD") {
        socket.send("RIGHT_UP");
        if (localInputRef.current.turn === 1) localInputRef.current.turn = 0;
      }
      if (e.code === "Space") {
        socket.send("SPACE_UP");
        localInputRef.current.accelerating = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      socket.close();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [hasJoined, nickname, skin, cameraModeRef]);

  // Очистка старых событий из логов (каждые 1 сек удаляем то, что старше 5 и 3 секунд)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setKillFeed(prev => prev.filter(k => now - k.time < 5000));
      setScoreFeed(prev => prev.filter(s => now - s.time < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected,
    statusMsg,
    leaderboard,
    killFeed,
    scoreFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    myIdRef,
    localInputRef,
  };
}
