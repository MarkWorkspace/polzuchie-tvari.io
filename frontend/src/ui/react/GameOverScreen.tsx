// ROLE: React death overlay, run summary, personal best and respawn action.
import { useEffect, useRef, useState } from "react";
import type { NetworkManager } from "../../game/NetworkManager";
import { t } from "../../lib/i18n";
import { type PersonalBest, type RunStats, updatePersonalBest } from "../personalStats";

interface PlayerInfo {
  score?: number;
  kills?: number;
  body_len?: number;
}

interface GameOverState {
  stats: RunStats;
  best: PersonalBest;
  isNewRecord: boolean;
}

interface GameOverScreenProps {
  networkManager: NetworkManager;
  getMyId: () => string;
}

export function GameOverScreen({ networkManager, getMyId }: GameOverScreenProps) {
  const [state, setState] = useState<GameOverState | null>(null);
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
      if (!events.some((kill) => kill.victim === myId)) return;

      const player = players[myId] ?? {};
      const stats: RunStats = {
        score: Math.floor(player.score ?? 0),
        length: Math.floor(player.body_len ?? 0),
        kills: player.kills ?? 0,
      };
      const { best, isNewRecord } = updatePersonalBest(stats);
      setState({ stats, best, isNewRecord });
    };

    window.addEventListener("game-killfeed", handleKillFeed);
    return () => window.removeEventListener("game-killfeed", handleKillFeed);
  }, []);

  if (!state) return null;

  return (
    <div className="game-over-overlay hud-interactive">
      <div className="game-over-modal glass-panel">
        <h1 className="game-over-title">{t("gameOver.title")}</h1>
        <p className="game-over-subtitle">{t("gameOver.subtitle")}</p>

        <div className="game-over-stats">
          <div className="stat-box">
            <div className="stat-label">{t("gameOver.score")}</div>
            <div className="stat-value stat-score">{state.stats.score}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">{t("gameOver.length")}</div>
            <div className="stat-value stat-length">{state.stats.length}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">{t("gameOver.kills")}</div>
            <div className="stat-value stat-kills">{state.stats.kills}</div>
          </div>
        </div>

        <div className={`game-over-record ${state.isNewRecord ? "is-record" : ""}`}>
          {state.isNewRecord
            ? t("gameOver.newRecord")
            : t("gameOver.best", { score: state.best.score })}
        </div>

        <button
          type="button"
          className="respawn-btn"
          onClick={() => {
            networkManager.send("RESPAWN");
            setState(null);
          }}
        >
          {t("gameOver.playAgain")}
        </button>
      </div>
    </div>
  );
}
