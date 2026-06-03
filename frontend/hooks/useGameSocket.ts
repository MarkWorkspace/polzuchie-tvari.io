import { useEffect, useRef, useState, MutableRefObject } from "react";
import { GameState, Player, Food } from "../types/game";

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

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
  const [killFeed, setKillFeed] = useState<{ id: number; killer: string; victim: string; time: number }[]>([]);
  const lastLeaderboardJsonRef = useRef<string>("");

  const gameStateRef = useRef<GameState | null>(null);
  const lastGameStateRef = useRef<GameState | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const stateQueueRef = useRef<{ time: number; state: GameState }[]>([]);
  const myIdRef = useRef<string>("");
  const lastLeaderboardUpdateRef = useRef<number>(0);
  const localInputRef = useRef<{ turn: number; accelerating: boolean; touchX?: number | null; tiltX?: number | null }>({ turn: 0, accelerating: false, touchX: null, tiltX: null });
  
  const socketRef = useRef<{
    send: (msg: string) => void;
    readyState: number;
    close: () => void;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const lastScoreFeedTimeRef = useRef<number>(0);
  const lastScoreFeedDeltaRef = useRef<number>(0);
  const lastScoreFeedElRef = useRef<HTMLDivElement | null>(null);

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

    const buildWsUrl = () => {
      const host = window.location.hostname || "127.0.0.1";
      const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
      const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
      const wsPort = isStandardPort ? "" : ":8000";
      const trimmedNickname = nickname.trim() || "Игрок";
      return `${protocol}${host}${wsPort}/ws/?nickname=${encodeURIComponent(trimmedNickname)}&skin=${encodeURIComponent(skin)}`;
    };

    setConnectionStatus("connecting");
    setStatusMsg("Подключение к серверу...");

    // Create the worker
    const worker = new Worker(new URL("./game.worker.ts", import.meta.url));
    workerRef.current = worker;

    // Create the mock socket
    socketRef.current = {
      send: (msg: string) => {
        worker.postMessage({ type: "SEND", data: msg });
      },
      readyState: WebSocket.CONNECTING,
      close: () => {
        worker.postMessage({ type: "CLOSE" });
      }
    };

    worker.postMessage({ type: "CONNECT", url: buildWsUrl() });

    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg.type === "STATUS") {
        setConnectionStatus(msg.status);
        if (msg.status === "connected") {
          setStatusMsg(controlModeRef.current === "keyboard"
            ? "A/D/Стрелочки — рулить | Пробел — ускорение | C — камера | T — управление"
            : "Движение за курсором | Пробел — ускорение | C — камера | T — управление"
          );
          if (socketRef.current) socketRef.current.readyState = WebSocket.OPEN;
        } else {
          setStatusMsg(msg.msg);
          if (socketRef.current) socketRef.current.readyState = WebSocket.CONNECTING;
        }
      } else if (msg.type === "DISCONNECT") {
        if (socketRef.current) socketRef.current.readyState = WebSocket.CLOSED;
        
        const pingEl = document.getElementById("hud-ping");
        if (pingEl) {
          pingEl.textContent = "offline";
          pingEl.style.color = "#f87171";
        }
        window.dispatchEvent(new CustomEvent("game-leaderboard-update", { detail: [] }));
      } else if (msg.type === "PING") {
        const roundedPing = Math.round(msg.latency);
        const pingEl = document.getElementById("hud-ping");
        if (pingEl) {
          pingEl.textContent = `Ping: ${roundedPing} ms`;
          pingEl.style.color = roundedPing <= 75 ? "#4ade80" : roundedPing <= 150 ? "#fbbf24" : "#f87171";
        }
      } else if (msg.type === "YOUR_ID") {
        myIdRef.current = msg.your_id;
      } else if (msg.type === "STATE") {
        lastGameStateRef.current = gameStateRef.current;
        gameStateRef.current = msg.state;
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

        // Leaderboard Calculation
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
            .slice(0, 10);
          
          const boardJson = JSON.stringify(board);
          if (boardJson !== lastLeaderboardJsonRef.current) {
            lastLeaderboardJsonRef.current = boardJson;
            window.dispatchEvent(new CustomEvent("game-leaderboard-update", { detail: board }));
          }
          lastLeaderboardUpdateRef.current = performance.now();
        }

        // Score Feed Calculation (Direct DOM with accumulation)
        const currentPlayers = lastGameStateRef.current?.players || {};
        const nextPlayers = gameStateRef.current?.players || {};
        const myOldPlayer = currentPlayers[myIdRef.current];
        const myNewPlayer = nextPlayers[myIdRef.current];
        if (myOldPlayer && myNewPlayer) {
          const delta = myNewPlayer.score - myOldPlayer.score;
          if (delta > 0 || delta < -1) {
            const container = document.getElementById("hud-score-feed");
            if (container) {
              const now = Date.now();
              if (lastScoreFeedElRef.current && now - lastScoreFeedTimeRef.current < 800) {
                const newDelta = lastScoreFeedDeltaRef.current + delta;
                lastScoreFeedDeltaRef.current = newDelta;
                lastScoreFeedTimeRef.current = now;

                const div = lastScoreFeedElRef.current;
                div.textContent = newDelta > 0 ? `+${newDelta}` : `${newDelta}`;
                div.style.color = newDelta > 0 ? "#4ade80" : "#f87171";

                div.style.opacity = "1";
                div.style.transform = "translateY(0)";

                if ((div as any).fadeOutTimeout) clearTimeout((div as any).fadeOutTimeout);
                if ((div as any).removeTimeout) clearTimeout((div as any).removeTimeout);

                (div as any).fadeOutTimeout = setTimeout(() => {
                  div.style.opacity = "0";
                  div.style.transform = "translateY(-15px)";
                }, 1500);

                (div as any).removeTimeout = setTimeout(() => {
                  div.remove();
                  if (lastScoreFeedElRef.current === div) {
                    lastScoreFeedElRef.current = null;
                  }
                }, 2000);
              } else {
                const div = document.createElement("div");
                div.style.color = delta > 0 ? "#4ade80" : "#f87171";
                div.style.fontSize = "20px";
                div.style.fontWeight = "bold";
                div.style.textShadow = "0px 2px 4px rgba(0,0,0,0.8)";
                div.style.transition = "all 0.5s ease-out";
                div.style.opacity = "1";
                div.style.transform = "translateY(0)";
                div.textContent = delta > 0 ? `+${delta}` : `${delta}`;

                if (container.children.length >= 3) {
                  container.removeChild(container.firstChild!);
                }

                container.appendChild(div);

                lastScoreFeedElRef.current = div;
                lastScoreFeedDeltaRef.current = delta;
                lastScoreFeedTimeRef.current = now;

                (div as any).fadeOutTimeout = setTimeout(() => {
                  div.style.opacity = "0";
                  div.style.transform = "translateY(-15px)";
                }, 1500);

                (div as any).removeTimeout = setTimeout(() => {
                  div.remove();
                  if (lastScoreFeedElRef.current === div) {
                    lastScoreFeedElRef.current = null;
                  }
                }, 2000);
              }
            }
          }
        }

        // Kill Events Calculation
        if (msg.kill_events && msg.kill_events.length > 0) {
          const extractName = (id: string) => {
            if (!id) return "Стена";
            const player = gameStateRef.current?.players[id];
            return player?.nickname || id;
          };
          
          const newKills = msg.kill_events.map((e: any) => ({
            id: Date.now() + Math.random(),
            killer: extractName(e.killer || ""),
            victim: extractName(e.victim),
            time: Date.now()
          }));
          setKillFeed(prev => [...prev, ...newKills].slice(-5));
        }
      }
    };

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
      if (workerRef.current) {
        workerRef.current.postMessage({ type: "CLOSE" });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.readyState = WebSocket.CLOSED;
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
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    isConnected: connectionStatus === "connected",
    connectionStatus,
    statusMsg,
    killFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    stateQueueRef,
    myIdRef,
    localInputRef,
    controlMode,
    controlModeRef,
    setControlMode,
    socketRef
  };
}
