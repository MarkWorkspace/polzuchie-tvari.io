import React from "react";

interface LoginScreenProps {
  nickname: string;
  setNickname: (name: string) => void;
  onJoin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ nickname, setNickname, onJoin }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "100px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>Polzuchie-tvari.io</h1>
      <input
        type="text"
        placeholder="Ваш никнейм"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onJoin()}
        style={{ padding: "12px", fontSize: "18px", marginBottom: "20px", borderRadius: "8px", border: "2px solid #ccc", width: "250px", textAlign: "center" }}
        maxLength={12}
        autoFocus
      />
      <button
        onClick={onJoin}
        style={{ padding: "12px 30px", fontSize: "18px", cursor: "pointer", borderRadius: "8px", backgroundColor: "#4ade80", border: "none", fontWeight: "bold", color: "#111" }}
      >
        Играть
      </button>
    </div>
  );
};