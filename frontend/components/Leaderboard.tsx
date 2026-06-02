import React from "react";

interface LeaderboardEntry {
  id: string;
  score: number;
  kills: number;
  deaths: number;
  isMe: boolean;
  nickname?: string;
}

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard }) => {
  return (
    <div style={{ 
      background: "rgba(20, 22, 28, 0.75)", 
      border: "1px solid rgba(255, 255, 255, 0.08)", 
      padding: "16px", 
      borderRadius: "16px", 
      color: "white", 
      flex: "1 1 220px", 
      minWidth: "220px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
      backdropFilter: "blur(12px)",
      maxHeight: "calc(100vh - 250px)",
      display: "flex",
      flexDirection: "column"
    }}>
      <h3 style={{ margin: "0 0 12px 0", textAlign: "center", fontSize: "13px", fontWeight: 800, color: "rgba(255, 255, 255, 0.75)" }}>Топ 10</h3>
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
        {leaderboard.slice(0, 10).map((player, index) => {
          const displayName = player.nickname || player.id;
          return (
            <li key={player.id} style={{ padding: "8px 0", color: player.isMe ? "#4ade80" : "white", fontWeight: player.isMe ? "bold" : "normal", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" }}>{index + 1}. {displayName}</span>
                <span style={{ fontWeight: 700, color: player.isMe ? "#4ade80" : "#fafafa" }}>{player.score}</span>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px", fontWeight: 600 }}>
                <span title="Убийства" style={{ display: "flex", alignItems: "center", gap: "2px" }}>⚔️ {player.kills ?? 0}</span>
                <span title="Смерти" style={{ display: "flex", alignItems: "center", gap: "2px" }}>💀 {player.deaths ?? 0}</span>
              </div>
            </li>
          );
        })}
        {leaderboard.length === 0 && <li style={{ color: "rgba(255, 255, 255, 0.4)", textAlign: "center", padding: "10px 0" }}>Ожидание...</li>}
      </ul>
    </div>
  );
};
