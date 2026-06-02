"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isMobile, setIsMobile] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  const requestGyroPermission = async () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as any).requestPermission === "function"
    ) {
      try {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState === "granted") {
          setControlMode("tilt");
          controlModeRef.current = "tilt";
        } else {
          alert("Gyroscope permission denied.");
        }
      } catch (err) {
        console.error("Gyroscope permission request failed:", err);
      }
    } else {
      setControlMode("tilt");
      controlModeRef.current = "tilt";
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    setControlMode,
    socketRef
  } = useGameSocket(nickname, selectedSkin, hasJoined, cameraModeRef, isMobile);

  const isSteeringRef = useRef(false);

  useEffect(() => {
    if (!isMobile || !hasJoined) return;
 
    const handleTouch = (e: TouchEvent) => {
      // In tilt control mode, canvas touch steering is completely bypassed!
      if (controlModeRef.current === "tilt") {
        return;
      }

      // For touchmove, only proceed if we started steering on the canvas
      if (e.type === "touchmove" && !isSteeringRef.current) {
        return;
      }

      // For touchstart, verify target is the game canvas
      if (e.type === "touchstart") {
        const target = e.target as HTMLElement;
        if (!target || target.tagName !== "CANVAS") {
          isSteeringRef.current = false;
          return;
        }
        isSteeringRef.current = true;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      const sock = socketRef.current;
      if (!sock || sock.readyState !== WebSocket.OPEN) return;
 
      const touch = e.touches[0];
      if (!touch) return;
 
      const boostZoneHeight = window.innerHeight * 0.22;
      const isTouchInBoostZone = (window.innerHeight - touch.clientY) < boostZoneHeight;
 
      if (isTouchInBoostZone) {
        if (!localInputRef.current.accelerating) {
          sock.send("SPACE_DOWN");
          localInputRef.current.accelerating = true;
        }
      } else {
        if (localInputRef.current.accelerating) {
          sock.send("SPACE_UP");
          localInputRef.current.accelerating = false;
        }
      }

      // Calculate normalized X touch coordinate (-1 to 1) for mobile steering
      const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
      localInputRef.current.touchX = touchX;
    };
 
    const handleTouchEnd = (e: TouchEvent) => {
      if (controlModeRef.current === "tilt") {
        return;
      }

      if (isSteeringRef.current) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
      isSteeringRef.current = false;

      const sock = socketRef.current;
      if (sock && sock.readyState === WebSocket.OPEN) {
        if (localInputRef.current.accelerating) {
          sock.send("SPACE_UP");
          localInputRef.current.accelerating = false;
        }
        // Send TURN:0.0 instantly to guarantee server centers the steering!
        sock.send("TURN:0.0");
      }
      localInputRef.current.touchX = null;
      localInputRef.current.turn = 0.0;
    };
 
    window.addEventListener("touchstart", handleTouch, { passive: false });
    window.addEventListener("touchmove", handleTouch, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: false });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: false });
 
    return () => {
      window.removeEventListener("touchstart", handleTouch);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isMobile, hasJoined, controlMode, socketRef, localInputRef]);

  // Gyroscope/Accelerometer tilt steering controller
  useEffect(() => {
    if (!isMobile || !hasJoined || controlMode !== "tilt") {
      localInputRef.current.tiltX = null;
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      // e.gamma is rotation around the Y-axis (left/right tilt when phone is in portrait mode).
      if (e.gamma === null) return;

      const maxTiltAngle = 30;
      let tiltVal = e.gamma;

      // Small deadzone of 3 degrees to easily travel perfectly straight
      let desiredTurnFactor = 0;
      if (Math.abs(tiltVal) > 3) {
        desiredTurnFactor = tiltVal / maxTiltAngle;
        desiredTurnFactor = Math.max(-1.0, Math.min(1.0, desiredTurnFactor));
      }

      localInputRef.current.tiltX = desiredTurnFactor;
    };

    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      localInputRef.current.tiltX = null;
    };
  }, [isMobile, hasJoined, controlMode, localInputRef]);

  if (!hasJoined) {
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        minHeight: "100dvh", 
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
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, width: "100vw", height: "100dvh", overflow: "hidden", backgroundColor: "#222" }}>
      
      {/* Mobile Top Header */}
      {isMobile && connectionStatus === "connected" && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "60px",
          background: "rgba(20, 22, 28, 0.75)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          zIndex: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px"
        }}>
          {/* Burger Menu Button (Left) */}
          <div 
            onClick={() => setIsSidePanelOpen(true)}
            style={{
              cursor: "pointer",
              color: "white",
              fontSize: "24px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none"
            }}
          >
            ☰
          </div>

          {/* Centered H1 Header */}
          <h1 style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 900,
            color: "rgba(255, 255, 255, 0.95)",
            letterSpacing: "-0.01em",
            textShadow: "0 0 10px rgba(255, 255, 255, 0.15)"
          }}>
            Polzuchie-tvari.io
          </h1>

          {/* Symmetrical placeholder for spacing */}
          <div style={{ width: "40px" }} />
        </div>
      )}

      {/* Side Panel Drawer Backdrop Overlay */}
      {isMobile && isSidePanelOpen && (
        <div 
          onClick={() => setIsSidePanelOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 105,
            transition: "opacity 0.3s ease"
          }}
        />
      )}

      {/* Side Panel Drawer (Left) */}
      {isMobile && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          background: "rgba(20, 22, 28, 0.9)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "10px 0 32px rgba(0, 0, 0, 0.5)",
          zIndex: 110,
          transform: isSidePanelOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 20px",
          color: "white"
        }}>
          {/* Side Drawer Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>Меню игры / Menu</span>
            <div 
              onClick={() => setIsSidePanelOpen(false)}
              style={{ cursor: "pointer", fontSize: "18px", opacity: 0.6, padding: "4px" }}
            >
              ✕
            </div>
          </div>

          {/* Section 1: Camera Mode */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>Режим камеры / Camera</h3>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px" }}>
              <div 
                onClick={() => {
                  cameraModeRef.current = "2D";
                  setIsSidePanelOpen(false);
                }}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 0",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: cameraModeRef.current === "2D" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: cameraModeRef.current === "2D" ? "white" : "rgba(255,255,255,0.6)"
                }}
              >
                2D
              </div>
              <div 
                onClick={() => {
                  cameraModeRef.current = "3D";
                  setIsSidePanelOpen(false);
                }}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "8px 0",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: cameraModeRef.current === "3D" ? "rgba(255,255,255,0.1)" : "transparent",
                  color: cameraModeRef.current === "3D" ? "white" : "rgba(255,255,255,0.6)"
                }}
              >
                3D
              </div>
            </div>
          </div>

          {/* Section 2: Control Mode */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>Управление / Controls</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div 
                onClick={() => {
                  setControlMode("mouse");
                  controlModeRef.current = "mouse";
                  setIsSidePanelOpen(false);
                }}
                style={{
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: controlMode === "mouse" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.03)",
                  border: controlMode === "mouse" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(255,255,255,0.05)",
                  color: controlMode === "mouse" ? "#60a5fa" : "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <span style={{ fontSize: "16px" }}>👆</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>Сенсорный Драг</span>
                  <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>Drag steering + Boost zone</span>
                </div>
              </div>
              
              <div 
                onClick={() => {
                  const needsPermission = typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function";
                  if (needsPermission) {
                    requestGyroPermission();
                  } else {
                    setControlMode("tilt");
                    controlModeRef.current = "tilt";
                  }
                  setIsSidePanelOpen(false);
                }}
                style={{
                  padding: "12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: controlMode === "tilt" ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)",
                  border: controlMode === "tilt" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.05)",
                  color: controlMode === "tilt" ? "#f87171" : "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <span style={{ fontSize: "16px" }}>📱</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span>Наклон телефона</span>
                  <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>Tilt phone + Red Boost Button</span>
                </div>
              </div>

              {typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function" && (
                <div 
                  onClick={requestGyroPermission}
                  style={{
                    padding: "8px 12px",
                    fontSize: "11px",
                    textAlign: "center",
                    borderRadius: "6px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.5)",
                    marginTop: "4px"
                  }}
                >
                  ⚙️ Разрешить гироскоп (iOS)
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Help Instructions */}
          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px" }}>
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px", letterSpacing: "0.05em" }}>Подсказки / Guide</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
              {controlMode === "mouse" ? (
                <>
                  <div>• Тяните палец по холсту влево/вправо для плавного руления.</div>
                  <div>• Нижняя четверть экрана (22%) — зона буста. Ускоряйтесь при удержании.</div>
                </>
              ) : (
                <>
                  <div>• Наклоняйте телефон влево/вправо для плавного руления.</div>
                  <div>• Зажмите круглую красную кнопку внизу по центру для ускорения.</div>
                </>
              )}
              <div>• Очки собираются за поедание светящихся шариков еды.</div>
              <div>• Столкновение с телом другого игрока приводит к гибели!</div>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar Panel (Header HUD + Killfeed) */}
      <div style={{ position: "absolute", top: isMobile ? 234 : 20, left: isMobile ? 12 : 20, zIndex: 50, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
        
        {/* Header HUD Info */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}>
          {!isMobile && (
            <h1 style={{ margin: "0", fontSize: "22px", fontWeight: 800, color: "rgba(255, 255, 255, 0.9)" }}>
              Polzuchie-tvari.io
            </h1>
          )}
          
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
      <div style={{ position: "absolute", top: isMobile ? (isMobile ? 72 : 12) : 20, right: isMobile ? 12 : 20, zIndex: 50 }}>
        <Leaderboard leaderboard={leaderboard} />
      </div>

      {/* Bottom-left unified HUD Panel (Score feed + Collapsible Help Panel) */}
      <div style={{ 
        position: "absolute", 
        bottom: isMobile ? 12 : 20, 
        left: isMobile ? 12 : 20, 
        zIndex: 50, 
        pointerEvents: "none", 
        display: "flex", 
        flexDirection: "column-reverse", 
        gap: "12px" 
      }}>
        {connectionStatus === "connected" && !isMobile && (
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

        {/* Фид очков еды (Отображается над панелью подсказок/бустом) */}
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
      {(controlMode === "mouse" || controlMode === "tilt") && (
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

      {/* Mobile Boost Zone Visual Gradient Indicator (only in touch drag mode) */}
      {isMobile && controlMode === "mouse" && connectionStatus === "connected" && (
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "22%",
          background: "linear-gradient(to top, rgba(230, 57, 70, 0.16) 0%, rgba(230, 57, 70, 0.0) 100%)",
          borderTop: "1px dashed rgba(230, 57, 70, 0.3)",
          pointerEvents: "none",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255, 255, 255, 0.35)",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.1em"
        }}>
          🔥 ЗОНА УСКОРЕНИЯ (ДЕРЖИТЕ ПАЛЕЦ ЗДЕСЬ) / BOOST ZONE
        </div>
      )}

      {/* Mobile Dedicated Red Circular Boost Button (only in tilt steering mode) */}
      {isMobile && controlMode === "tilt" && connectionStatus === "connected" && (
        <button
          onTouchStart={(e) => {
            if (e.cancelable) e.preventDefault();
            const sock = socketRef.current;
            if (sock && sock.readyState === WebSocket.OPEN) {
              if (!localInputRef.current.accelerating) {
                sock.send("SPACE_DOWN");
                localInputRef.current.accelerating = true;
              }
            }
          }}
          onTouchEnd={(e) => {
            if (e.cancelable) e.preventDefault();
            const sock = socketRef.current;
            if (sock && sock.readyState === WebSocket.OPEN) {
              if (localInputRef.current.accelerating) {
                sock.send("SPACE_UP");
                localInputRef.current.accelerating = false;
              }
            }
          }}
          onTouchCancel={(e) => {
            if (e.cancelable) e.preventDefault();
            const sock = socketRef.current;
            if (sock && sock.readyState === WebSocket.OPEN) {
              if (localInputRef.current.accelerating) {
                sock.send("SPACE_UP");
                localInputRef.current.accelerating = false;
              }
            }
          }}
          style={{
            position: "absolute",
            bottom: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            width: "90px",
            height: "90px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #ef4444 0%, #b91c1c 100%)",
            border: "2px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 0 25px rgba(239, 68, 68, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.3), 0 8px 32px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 900,
            fontSize: "11px",
            letterSpacing: "0.05em",
            cursor: "pointer",
            outline: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "none"
          }}
        >
          <span style={{ fontSize: "20px", marginBottom: "2px" }}>🔥</span>
          <span>БУСТ</span>
          <span style={{ fontSize: "7px", opacity: 0.8 }}>BOOST</span>
        </button>
      )}

      {/* Пинг в правом нижнем углу */}
      <div style={{ 
        position: "absolute", 
        bottom: isMobile ? "12px" : "182px", 
        right: isMobile ? "12px" : "20px", 
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
        isMobile={isMobile}
      />
    </div>
  );
}
