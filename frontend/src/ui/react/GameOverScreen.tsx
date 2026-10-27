// ROLE: React death overlay and respawn action.
import { useEffect, useRef, useState } from "react";
import type { NetworkManager } from "../../game/NetworkManager";

interface PlayerInfo {
  score?: number;
  kills?: number;
}

interface GameOverScreenProps {
  networkManager: NetworkManager;
  getMyId: () => string;
}

export function GameOverScreen({ networkManager, getMyId }: GameOverScreenProps) {
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo | null>(null);
  const getMyIdRef = useRef(getMyId);

  useEffect(() => {
    getMyIdRef.current = getMyId;
  }, [getMyId]);

  useEffect(() => {
    const handleKillFeed = (event: Event) => {
      const { events, players } = (event as CustomEvent).detail as {
        events: Array<{ victim: string }>;
        players: Record<string, PlayerInfo>;
      };
      const myId = getMyIdRef.current();
      if (!myId) return;
      if (events.some((kill) => kill.victim === myId)) {
        setPlayerInfo(players[myId] ?? {});
      }
    };

    window.addEventListener("game-killfeed", handleKillFeed);
    return () => window.removeEventListener("game-killfeed", handleKillFeed);
  }, []);

  if (!playerInfo) return null;

  return (
    <div className="game-over-overlay hud-interactive">
      <div className="game-over-modal glass-panel">
        <h1 className="game-over-title">ПОТРАЧЕНО</h1>
        <p className="game-over-subtitle">Твоя змейка стала кормом для других.</p>

        <div className="game-over-stats">
          <div className="stat-box">
            <div className="stat-label">Длина</div>
            <div className="stat-value stat-score">{Math.floor(playerInfo.score ?? 0)}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Фраги</div>
            <div className="stat-value stat-kills">{playerInfo.kills ?? 0}</div>
          </div>
        </div>

        <button
          type="button"
          className="respawn-btn"
          onClick={() => {
            networkManager.send("RESPAWN");
            setPlayerInfo(null);
          }}
        >
          ИГРАТЬ СНОВА
        </button>
      </div>
    </div>
  );
}
