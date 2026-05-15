"use client";

import { useRef, useState } from "react";
import { useGameSocket } from "../hooks/useGameSocket";
import { LoginScreen } from "../components/LoginScreen";
import { Leaderboard } from "../components/Leaderboard";
import { GameRenderer } from "../components/GameRenderer";

const SKINS = [
  { id: "#ef4444", name: "Красный", bg: "#ef4444" },
  { id: "#3b82f6", name: "Синий", bg: "#3b82f6" },
  { id: "#eab308", name: "Желтый", bg: "#eab308" },
  { id: "#22c55e", name: "Зеленый", bg: "#22c55e" },
  { id: "#ec4899", name: "Розовый", bg: "#ec4899" },
  { id: "#a855f7", name: "Фиолетовый", bg: "#a855f7" },
  { id: "zebra", name: "Зебра", bg: "repeating-linear-gradient(45deg, #fff, #fff 10px, #000 10px, #000 20px)" },
  { id: "tiger", name: "Тигр", bg: "repeating-linear-gradient(45deg, #f97316, #f97316 10px, #000 10px, #000 20px)" },
  { id: "rainbow", name: "Радуга", bg: "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)" },
  { id: "cyberpunk", name: "Киберпанк", bg: "repeating-linear-gradient(45deg, #f0f, #f0f 10px, #0ff 10px, #0ff 20px)" }
];

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [selectedSkin, setSelectedSkin] = useState(SKINS[3].id);
  const [hasJoined, setHasJoined] = useState(false);
  const cameraModeRef = useRef<"2D" | "3D">("2D");

  const {
    statusMsg,
    leaderboard,
    killFeed,
    scoreFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    myIdRef,
    localInputRef,
  } = useGameSocket(nickname, selectedSkin, hasJoined, cameraModeRef);

  if (!hasJoined) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#111", color: "white" }}>
        <h1 style={{ marginBottom: "20px" }}>Polzuchie-tvari.io</h1>
        
        <div style={{ marginBottom: "30px", textAlign: "center" }}>
          <h3 style={{ marginBottom: "15px" }}>Выберите скин:</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", maxWidth: "300px" }}>
            {SKINS.map((skin) => (
              <button
                key={skin.id}
                onClick={() => setSelectedSkin(skin.id)}
                style={{
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: skin.bg, cursor: "pointer",
                  border: selectedSkin === skin.id ? "3px solid white" : "2px solid #555",
                  boxShadow: selectedSkin === skin.id ? "0 0 10px white" : "none"
                }}
                title={skin.name}
              />
            ))}
          </div>
        </div>

        <LoginScreen
          nickname={nickname}
          setNickname={setNickname}
          onJoin={() => setHasJoined(true)}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#222", fontFamily: "sans-serif" }}>
      
      {/* HUD (Top center) */}
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 50, pointerEvents: "none", textAlign: "center", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
        <h1 style={{ margin: "0 0 5px 0", fontSize: "24px" }}>Polzuchie-tvari.io</h1>
        <p style={{ margin: 0, fontSize: "14px" }}>{statusMsg}</p>
      </div>

      {/* Киллфид (Слева сверху) */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 50, pointerEvents: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
        {killFeed.map(k => (
          <div key={k.id} style={{ color: "white", backgroundColor: "rgba(0,0,0,0.5)", padding: "4px 8px", borderRadius: 4, fontSize: "14px", fontWeight: "bold" }}>
            <span style={{ color: "#4ade80" }}>{k.killer}</span> ⚔️ <span style={{ color: "#f87171" }}>{k.victim}</span>
          </div>
        ))}
      </div>

      {/* Таблица лидеров (Справа сверху) */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 50 }}>
        <Leaderboard leaderboard={leaderboard} myId={myIdRef.current} />
      </div>

      {/* Фид очков еды (Снизу по центру) */}
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)", zIndex: 50, pointerEvents: "none", textAlign: "center", display: "flex", flexDirection: "column", gap: "4px" }}>
        {scoreFeed.map(s => (
          <div key={s.id} style={{ color: s.delta > 0 ? "#4ade80" : "#f87171", fontSize: "20px", fontWeight: "bold", textShadow: "0px 2px 4px rgba(0,0,0,0.8)" }}>
            {s.delta > 0 ? `+${s.delta}` : s.delta}
          </div>
        ))}
      </div>

      <GameRenderer
        gameStateRef={gameStateRef}
        lastGameStateRef={lastGameStateRef}
        lastUpdateTimeRef={lastUpdateTimeRef}
        myIdRef={myIdRef}
        cameraModeRef={cameraModeRef}
        localInputRef={localInputRef}
      />
    </div>
  );
}