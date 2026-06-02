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
  const [isHelpOpen, setIsHelpOpen] = useState(true);
  const cameraModeRef = useRef<"2D" | "3D">("2D");

  const {
    connectionStatus,
    statusMsg,
    leaderboard,
    killFeed,
    scoreFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    stateQueueRef,
    myIdRef,
    localInputRef,
    ping,
    activePlayersCount,
    controlMode,
    controlModeRef,
    socketRef
  } = useGameSocket(nickname, selectedSkin, hasJoined, cameraModeRef);

  if (!hasJoined) {
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        minHeight: "100vh", 
        background: "radial-gradient(circle at center, #181922 0%, #0c0c0f 100%)", 
        color: "white" 
      }}>
        <LoginScreen
          nickname={nickname}
          setNickname={setNickname}
          onJoin={() => setHasJoined(true)}
          selectedSkin={selectedSkin}
          setSelectedSkin={setSelectedSkin}
          skins={SKINS}
        />
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#222" }}>
      
      {/* Left Sidebar Panel (Header HUD + Killfeed) */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 50, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
        
        {/* Header HUD Info */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          <h1 style={{ margin: "0", fontSize: "22px", fontWeight: 800, color: "rgba(255, 255, 255, 0.9)" }}>
            Polzuchie-tvari.io
          </h1>
          
          {connectionStatus !== "connected" && (
            <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#fafafa", opacity: 0.8, fontWeight: 500 }}>
              {statusMsg}
            </p>
          )}
        </div>

        {/* Киллфид */}
        {killFeed.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {killFeed.map(k => (
              <div 
                key={k.id} 
                style={{ 
                  color: "#fafafa", 
                  background: "rgba(20, 22, 28, 0.75)", 
                  border: "1px solid rgba(255, 255, 255, 0.08)", 
                  padding: "6px 12px", 
                  borderRadius: "10px", 
                  fontSize: "12px", 
                  fontWeight: 600, 
                  width: "fit-content",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
                  backdropFilter: "blur(8px)"
                }}
              >
                <span style={{ color: "#4ade80", fontWeight: 700 }}>{k.killer}</span>
                <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 6px" }}>⚔️</span>
                <span style={{ color: "#f87171", fontWeight: 700 }}>{k.victim}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Таблица лидеров (Справа сверху) */}
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 50 }}>
        <Leaderboard leaderboard={leaderboard} />
      </div>

      {/* Bottom-left unified HUD Panel (Score feed + Collapsible Help Panel) */}
      <div style={{ 
        position: "absolute", 
        bottom: 20, 
        left: 20, 
        zIndex: 50, 
        pointerEvents: "none", 
        display: "flex", 
        flexDirection: "column-reverse", 
        gap: "12px" 
      }}>
        {connectionStatus === "connected" && (
          /* Collapsible Helper Panel (Single Unified Card Box) */
          <div 
            style={{
              pointerEvents: "auto",
              background: "rgba(20, 22, 28, 0.75)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "16px",
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
              display: "flex",
              flexDirection: "column-reverse",
              gap: isHelpOpen ? "10px" : "0px",
              width: "220px",
              transition: "all 0.2s ease",
              textShadow: "none"
            }}
          >
            {/* Header (Clickable toggle trigger) */}
            <div 
              onClick={() => setIsHelpOpen(prev => !prev)}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "rgba(255, 255, 255, 0.75)",
                fontSize: "13px",
                fontWeight: 800,
                userSelect: "none"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#60a5fa";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.75)";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>⌨️</span> Управление
              </span>
              <span style={{ 
                fontSize: "8px", 
                transition: "transform 0.2s ease", 
                transform: isHelpOpen ? "rotate(180deg)" : "rotate(0deg)",
                color: "rgba(255,255,255,0.6)",
                display: "inline-block"
              }}>
                ▲
              </span>
            </div>

            {/* Body (Conditional list of keys) */}
            {isHelpOpen && (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "6px",
                fontSize: "12px", 
                color: "rgba(255, 255, 255, 0.65)",
                fontWeight: 500,
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                paddingBottom: "8px"
              }}>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#fafafa" }}>
                    {controlMode === "keyboard" ? "A / D / Стрелочки" : "Движение мыши"}
                  </kbd>
                  <span>— Руление</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#fafafa" }}>
                    Пробел
                  </kbd>
                  <span>— Ускорение</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#fafafa" }}>
                    C
                  </kbd>
                  <span>— Смена камеры (2D / 3D)</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.35)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#60a5fa" }}>
                    T
                  </kbd>
                  <span>
                    — Режим: <strong style={{ color: "#60a5fa", fontWeight: "normal" }}>{controlMode === "keyboard" ? "клавиатура" : "мышь"}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Фид очков еды (Отображается над панелью подсказок) */}
        {scoreFeed.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {scoreFeed.map(s => (
              <div key={s.id} style={{ color: s.delta > 0 ? "#4ade80" : "#f87171", fontSize: "20px", fontWeight: "bold", textShadow: "0px 2px 4px rgba(0,0,0,0.8)" }}>
                {s.delta > 0 ? `+${s.delta}` : s.delta}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Шкала-индикатор поворота (По центру снизу, прижатая к самому низу) */}
      {controlMode === "mouse" && (
        <div 
          style={{
            position: "absolute",
            bottom: "0px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "rgba(20, 22, 28, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderBottom: "none",
            padding: "8px 24px",
            borderRadius: "12px 12px 0 0",
            boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.3)",
            backdropFilter: "blur(12px)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {/* Индикатор-шкала */}
          <div 
            style={{
              position: "relative",
              width: "280px",
              height: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "6px",
              overflow: "visible"
            }}
          >
            {/* Центральная риска */}
            <div 
              style={{
                position: "absolute",
                left: "50%",
                top: "-4px",
                bottom: "-4px",
                width: "2px",
                background: "rgba(255, 255, 255, 0.3)",
                transform: "translateX(-50%)",
                zIndex: 2
              }}
            />
            
            {/* Четвертные риски */}
            <div 
              style={{
                position: "absolute",
                left: "25%",
                top: 0,
                bottom: 0,
                width: "1px",
                background: "rgba(255, 255, 255, 0.12)",
                transform: "translateX(-50%)"
              }}
            />
            <div 
              style={{
                position: "absolute",
                left: "75%",
                top: 0,
                bottom: 0,
                width: "1px",
                background: "rgba(255, 255, 255, 0.12)",
                transform: "translateX(-50%)"
              }}
            />

            {/* Активная область отклонения (динамическая заливка) */}
            <div 
              id="mouse-turn-fill"
              style={{
                position: "absolute",
                height: "100%",
                left: "50%",
                width: "0%",
                borderRadius: "4px",
                transformOrigin: "left center",
                transition: "background 0.2s ease"
              }}
            />

            {/* Ползунок-игла (динамическое скольжение) */}
            <div 
              id="mouse-turn-needle"
              style={{
                position: "absolute",
                left: "50%",
                top: "-5px",
                width: "8px",
                height: "18px",
                background: "#fafafa",
                border: "1px solid rgba(0, 0, 0, 0.3)",
                borderRadius: "4px",
                boxShadow: "0 0 10px rgba(255, 255, 255, 0.5)",
                transform: "translateX(-50%)",
                transition: "background-color 0.1s ease, box-shadow 0.1s ease, transform 0.1s ease",
                zIndex: 3
              }}
            />
          </div>
        </div>
      )}

      {/* Пинг в правом нижнем углу над миникартой */}
      <div style={{ 
        position: "absolute", 
        bottom: "182px", 
        right: "20px", 
        zIndex: 50, 
        pointerEvents: "none",
        textAlign: "right"
      }}>
        {connectionStatus === "connected" && ping !== null ? (
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            color: ping <= 75 ? "#4ade80" : ping <= 150 ? "#fbbf24" : "#f87171",
            transition: "color 0.2s ease",
            textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000"
          }}>
            Ping: {ping} ms
          </span>
        ) : (
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#f87171",
            textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000"
          }}>
            offline
          </span>
        )}
      </div>

      <GameRenderer
        gameStateRef={gameStateRef}
        lastGameStateRef={lastGameStateRef}
        lastUpdateTimeRef={lastUpdateTimeRef}
        stateQueueRef={stateQueueRef}
        myIdRef={myIdRef}
        cameraModeRef={cameraModeRef}
        localInputRef={localInputRef}
        controlModeRef={controlModeRef}
        socketRef={socketRef}
      />
    </div>
  );
}
