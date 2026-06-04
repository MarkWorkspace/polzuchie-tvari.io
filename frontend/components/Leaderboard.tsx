import React from "react";
import { t } from "../lib/i18n";

interface LeaderboardEntry {
  id: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
  nickname?: string;
}

interface LeaderboardProps {
  leaderboard?: LeaderboardEntry[];
  limit?: number;
  alwaysOpen?: boolean;
  noBackground?: boolean;
  alignLeft?: boolean;
  hideTitle?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  leaderboard,
  limit = 10,
  alwaysOpen = false,
  noBackground = false,
  alignLeft = false,
  hideTitle = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const [localLeaderboard, setLocalLeaderboard] = React.useState<LeaderboardEntry[]>([]);

  React.useEffect(() => {
    if (alwaysOpen) {
      setIsOpen(true);
      return;
    }
    const isMobileDevice = typeof window !== "undefined" && (
      window.matchMedia("(pointer: coarse)").matches || 
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
    if (isMobileDevice) {
      setIsOpen(false);
    }
  }, [alwaysOpen]);

  React.useEffect(() => {
    if (leaderboard) {
      setLocalLeaderboard(leaderboard);
      return;
    }
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<LeaderboardEntry[]>;
      setLocalLeaderboard(customEvent.detail || []);
    };
    window.addEventListener("game-leaderboard-update", handleUpdate);
    return () => {
      window.removeEventListener("game-leaderboard-update", handleUpdate);
    };
  }, [leaderboard]);

  return (
    <div style={{ 
      background: noBackground ? "transparent" : "rgba(20, 22, 28, 0.75)", 
      border: noBackground ? "none" : "1px solid rgba(255, 255, 255, 0.08)", 
      padding: noBackground ? "0" : "16px", 
      borderRadius: "16px", 
      color: "white", 
      flex: noBackground ? "none" : "1 1 220px", 
      minWidth: noBackground ? "none" : "220px",
      boxShadow: noBackground ? "none" : "0 8px 32px rgba(0, 0, 0, 0.4)",
      backdropFilter: noBackground ? "none" : "blur(12px)",
      maxHeight: noBackground ? "none" : "calc(100vh - 250px)",
      display: "flex",
      flexDirection: "column",
      gap: (isOpen || alwaysOpen) ? (limit <= 3 ? "6px" : "12px") : "0px",
      transition: "all 0.2s ease"
    }}>
      {!hideTitle && (
        <div 
          onClick={() => { if (!alwaysOpen) setIsOpen(prev => !prev); }}
          style={{
            cursor: alwaysOpen ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: alignLeft ? "flex-start" : "space-between",
            color: "rgba(255, 255, 255, 0.75)",
            fontSize: "13px",
            fontWeight: 800,
            userSelect: "none"
          }}
          onMouseEnter={(e) => {
            if (!alwaysOpen) e.currentTarget.style.color = "#60a5fa";
          }}
          onMouseLeave={(e) => {
            if (!alwaysOpen) e.currentTarget.style.color = "rgba(255, 255, 255, 0.75)";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🏆</span> {t("leaderboard.top")} {limit}
          </span>
          {!alwaysOpen && (
            <span style={{ 
              fontSize: "8px", 
              transition: "transform 0.2s ease", 
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: "rgba(255,255,255,0.6)",
              display: "inline-block"
            }}>
              ▲
            </span>
          )}
        </div>
      )}

      {(isOpen || alwaysOpen) && (
        <ul 
          className="custom-scrollbar"
          style={{ 
            listStyle: "none", 
            padding: 0, 
            margin: 0, 
            fontSize: "14px",
            overflowY: "auto",
            paddingRight: "4px"
          }}
        >
          {localLeaderboard.slice(0, limit).map((player, index) => {
            const displayName = player.nickname || player.id;
            return (
              <li key={player.id} style={{ padding: limit <= 3 ? "4px 0" : "8px 0", color: player.isMe ? "#4ade80" : "white", fontWeight: player.isMe ? "bold" : "normal", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" }}>{index + 1}. {displayName}</span>
                  <span style={{ fontWeight: 700, color: player.isMe ? "#4ade80" : "#fafafa" }}>{player.score}</span>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px", fontWeight: 600 }}>
                  <span title={t("leaderboard.kills")} style={{ display: "flex", alignItems: "center", gap: "2px" }}>⚔️ {player.kills ?? 0}</span>
                  <span title={t("leaderboard.deaths")} style={{ display: "flex", alignItems: "center", gap: "2px" }}>💀 {player.deaths ?? 0}</span>
                </div>
              </li>
            );
          })}
          {localLeaderboard.length === 0 && <li style={{ color: "rgba(255, 255, 255, 0.4)", textAlign: "center", padding: "10px 0" }}>{t("leaderboard.waiting")}</li>}
        </ul>
      )}
    </div>
  );
};
