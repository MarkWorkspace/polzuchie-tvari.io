import React from "react";

interface LeaderboardProps {
  leaderboard: { id: string; score: number; kills: number; deaths: number; isMe: boolean }[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ leaderboard }) => {
  return (
    <div style={{ backgroundColor: "#222", border: "2px solid #333", padding: "15px", borderRadius: "8px", color: "white", flex: "1 1 200px", minWidth: "200px" }}>
      <h3 style={{ margin: "0 0 10px 0", textAlign: "center", fontSize: "16px" }}>Таблица лидеров</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "14px" }}>
        {leaderboard.map((player, index) => {
          const displayName = player.isMe ? "Вы" : player.id.split('_')[0];
          return (
            <li key={player.id} style={{ padding: "8px 0", color: player.isMe ? "#4ade80" : "white", fontWeight: player.isMe ? "bold" : "normal", borderBottom: "1px solid #444" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{index + 1}. {displayName}</span>
                <span>{player.score}</span>
              </div>
              <div style={{ fontSize: "11px", color: "#aaa", display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "2px" }}>
                <span title="Убийства">⚔️ {player.kills ?? 0}</span>
                <span title="Смерти">💀 {player.deaths ?? 0}</span>
              </div>
            </li>
          );
        })}
        {leaderboard.length === 0 && <li style={{ color: "#aaa", textAlign: "center" }}>Ожидание...</li>}
      </ul>
    </div>
  );
};
