// ROLE: React top-players table shared by the in-game HUD and the settings drawer.
import { useState } from "react";
import { t } from "../../lib/i18n";
import { useGameLeaderboard } from "./gameUiStore";

export interface LeaderboardProps {
  limit?: number;
  hideHeader?: boolean;
  plain?: boolean;
  alwaysOpen?: boolean;
  showMobileTitle?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

function detectMobile(): boolean {
  if (typeof window === "undefined") return false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarsePointer || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function Leaderboard({
  limit = 10,
  hideHeader = false,
  plain = false,
  alwaysOpen = false,
  showMobileTitle = false,
  selectedId = null,
  onSelect,
}: LeaderboardProps) {
  const entries = useGameLeaderboard();
  const [isMobile] = useState(detectMobile);
  const [open, setOpen] = useState(() => alwaysOpen || !isMobile);
  const canCollapse = !alwaysOpen && isMobile;

  const headerContent = (
    <>
      <span>
        🏆 {t("leaderboard.top")} {limit}
      </span>
      {canCollapse ? (
        <span className={`leaderboard-arrow ${open ? "open" : ""}`} aria-hidden="true">
          ▲
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={`leaderboard-panel hud-interactive ${plain ? "leaderboard-panel--plain" : "glass-panel"}`}
    >
      {hideHeader ? null : canCollapse ? (
        <button
          type="button"
          className="leaderboard-header leaderboard-header--collapsible"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {headerContent}
        </button>
      ) : (
        <div className="leaderboard-header">{headerContent}</div>
      )}

      {showMobileTitle ? (
        <div className="mobile-leaderboard-title">
          <span aria-hidden="true">🏆</span> Top {limit}
        </div>
      ) : null}

      {open ? (
        <div className="leaderboard-list custom-scrollbar">
          {entries.length === 0 ? (
            <div className="leaderboard-empty">{t("leaderboard.waiting")}</div>
          ) : (
            entries.slice(0, limit).map((player, index) => {
              const className = `leaderboard-item ${player.isMe ? "self" : ""} ${
                onSelect ? "leaderboard-item--selectable" : ""
              } ${selectedId === player.id ? "selected" : ""}`;
              const content = (
                <>
                  <div className="leaderboard-item-main">
                    <span className={`leaderboard-name ${player.isMe ? "self" : ""}`}>
                      <span className="leaderboard-rank">{index + 1}.</span>{" "}
                      {player.nickname || player.id.substring(0, 8)}
                    </span>
                    <span className={`leaderboard-score ${player.isMe ? "self" : ""}`}>
                      {player.score}
                    </span>
                  </div>
                  <div className="leaderboard-stats">
                    <span title={t("leaderboard.kills")}>⚔️ {player.kills ?? 0}</span>
                    <span title={t("leaderboard.deaths")}>💀 {player.deaths ?? 0}</span>
                  </div>
                </>
              );

              if (!onSelect) {
                return (
                  <div key={player.id} className={className}>
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={player.id}
                  type="button"
                  className={className}
                  aria-pressed={selectedId === player.id}
                  onClick={() => onSelect(player.id)}
                >
                  {content}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
