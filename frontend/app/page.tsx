"use client";

import { useEffect, useRef, useState } from "react";
import { useGameSocket } from "../hooks/useGameSocket";
import { LoginScreen } from "../components/LoginScreen";
import { Leaderboard } from "../components/Leaderboard";
import { GameRenderer } from "../components/GameRenderer";
import { t } from "../lib/i18n";

const SKINS = [
  { id: "#ef4444", name: "Красный", key: "skin.red", bg: "#ef4444" },
  { id: "#3b82f6", name: "Синий", key: "skin.blue", bg: "#3b82f6" },
  { id: "#eab308", name: "Желтый", key: "skin.yellow", bg: "#eab308" },
  { id: "#22c55e", name: "Зеленый", key: "skin.green", bg: "#22c55e" },
  { id: "#ec4899", name: "Розовый", key: "skin.pink", bg: "#ec4899" },
  { id: "#a855f7", name: "Фиолетовый", key: "skin.purple", bg: "#a855f7" },
  { id: "zebra", name: "Зебра", key: "skin.zebra", bg: "repeating-linear-gradient(45deg, #fff, #fff 10px, #000 10px, #000 20px)" },
  { id: "tiger", name: "Тигр", key: "skin.tiger", bg: "repeating-linear-gradient(45deg, #f97316, #f97316 10px, #000 10px, #000 20px)" },
  { id: "rainbow", name: "Радуга", key: "skin.rainbow", bg: "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)" },
  { id: "cyberpunk", name: "Киберпанк", key: "skin.cyberpunk", bg: "repeating-linear-gradient(45deg, #f0f, #f0f 10px, #0ff 10px, #0ff 20px)" }
];

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [selectedSkin, setSelectedSkin] = useState(SKINS[3].id);
  const [hasJoined, setHasJoined] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(true);
  const cameraModeRef = useRef<"2D" | "3D">("3D");
  const [isMobile, setIsMobile] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [debugMode, setDebugMode] = useState(false);

  const requestGyroPermission = async () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert(t("alert.gyroSecureRequired"));
      return;
    }
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
          alert(t("alert.gyroDenied"));
        }
      } catch (err) {
        console.error("Gyroscope permission request failed:", err);
      }
    } else {
      setControlMode("tilt");
      controlModeRef.current = "tilt";
    }
  };

  const handleTiltActivation = () => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      alert(t("alert.gyroSecureRequired"));
      return;
    }
    const needsPermission = typeof DeviceOrientationEvent !== "undefined" && typeof (DeviceOrientationEvent as any).requestPermission === "function";
    if (needsPermission) {
      requestGyroPermission();
    } else {
      setControlMode("tilt");
      controlModeRef.current = "tilt";
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      const isCoarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
      const isMobileUA = typeof window !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsMobile(isCoarse || isMobileUA);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("debug") === "true") {
      const savedPassword = window.localStorage.getItem("snake-admin-password");
      if (!savedPassword) {
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      const verifyAdminSession = async () => {
        const host = window.location.hostname || "127.0.0.1";
        const protocol = window.location.protocol;
        const isStandardPort = window.location.port === "" || window.location.port === "80" || window.location.port === "443";
        const url = isStandardPort 
          ? `${protocol}//${host}/ws/admin/config` 
          : `${protocol}//${host}:8000/admin/config`;

        try {
          const response = await fetch(url, {
            headers: { "x-admin-password": savedPassword },
          });
          if (response.ok) {
            setDebugMode(true);
            console.log("Admin verified. Debug Mode active.");
          } else {
            console.warn("Invalid admin session. Stripping debug mode.");
            window.history.replaceState(null, "", window.location.pathname);
          }
        } catch (e) {
          console.error("Failed to verify admin session:", e);
          window.history.replaceState(null, "", window.location.pathname);
        }
      };

      verifyAdminSession();
    }
  }, []);

  const {
    connectionStatus,
    statusMsg,
    killFeed,
    gameStateRef,
    lastGameStateRef,
    lastUpdateTimeRef,
    stateQueueRef,
    myIdRef,
    localInputRef,
    controlMode,
    controlModeRef,
    setControlMode,
    socketRef,
    workerRef,
    latestFrameDataRef,
    isWaitingForFrameRef
  } = useGameSocket(nickname, selectedSkin, hasJoined, cameraModeRef, isMobile);

  const isSteeringRef = useRef(false);

  useEffect(() => {
    if (!debugMode) return;

    const handleHudClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.id === "debug-score-val") {
        e.preventDefault();
        const currentScore = parseInt(target.getAttribute("data-score") || "0", 10);
        const newScoreStr = prompt(t("debug.enterScore"), currentScore.toString());
        if (newScoreStr !== null) {
          const val = parseInt(newScoreStr.trim(), 10);
          if (!isNaN(val) && val >= 0) {
            const sock = socketRef.current;
            if (sock && sock.readyState === WebSocket.OPEN) {
              sock.send(`SCORE:${val}`);
            }
          } else {
            alert(t("debug.invalidScore"));
          }
        }
      }
    };

    document.addEventListener("mousedown", handleHudClick, { passive: false });
    document.addEventListener("touchstart", handleHudClick, { passive: false });
    return () => {
      document.removeEventListener("mousedown", handleHudClick);
      document.removeEventListener("touchstart", handleHudClick);
    };
  }, [debugMode, socketRef]);

  useEffect(() => {
    if (!isMobile || !hasJoined) return;
 
    const handleTouch = (e: TouchEvent) => {
      // In tilt control mode, only allow boost zone touches (no canvas steering)
      if (controlModeRef.current === "tilt") {
        const touch = e.touches[0];
        if (!touch) return;
        const sock = socketRef.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) return;
        const boostZoneEl = document.getElementById('mobile-boost-zone');
        if (boostZoneEl) {
          const rect = boostZoneEl.getBoundingClientRect();
          const isTouchInBoostZone = touch.clientY >= rect.top;
          if (isTouchInBoostZone) {
            if (e.cancelable) e.preventDefault();
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
        }
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
 
      const boostZoneEl = document.getElementById('mobile-boost-zone');
      let isTouchInBoostZone = false;
      if (boostZoneEl) {
        const rect = boostZoneEl.getBoundingClientRect();
        isTouchInBoostZone = touch.clientY >= rect.top;
      }
 
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
        const sock = socketRef.current;
        if (sock && sock.readyState === WebSocket.OPEN) {
          if (localInputRef.current.accelerating) {
            sock.send("SPACE_UP");
            localInputRef.current.accelerating = false;
          }
        }
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
    if (!hasJoined || controlMode !== "tilt") {
      localInputRef.current.tiltX = null;
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta === null || gamma === null) return;

      // Determine screen orientation angle
      let screenAngle = 0;
      if (typeof window !== "undefined") {
        if (window.screen && window.screen.orientation) {
          screenAngle = window.screen.orientation.angle;
        } else if (typeof window.orientation !== "undefined") {
          screenAngle = window.orientation as number;
        } else {
          // Fallback if orientation APIs are completely missing
          screenAngle = window.innerWidth > window.innerHeight ? 90 : 0;
        }
      }

      let tiltVal = 0;
      // Math.abs(screenAngle) === 90 or 270 represents landscape
      if (Math.abs(screenAngle) === 90 || Math.abs(screenAngle) === 270) {
        // Landscape mode: tilt left/right corresponds to rotation around the X-axis (beta).
        // If the screen is rotated 90 degrees clockwise (screenAngle is -90 or 270),
        // we invert beta to keep the steering direction intuitive.
        tiltVal = (screenAngle === -90 || screenAngle === 270) ? -beta : beta;
      } else {
        // Portrait mode: tilt left/right corresponds to rotation around the Y-axis (gamma).
        // If the screen is rotated 180 degrees (upside down), we invert gamma.
        tiltVal = (screenAngle === 180) ? -gamma : gamma;
      }

      const maxTiltAngle = 30; // 30 degrees deflection for full steer
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
  }, [hasJoined, controlMode, localInputRef]);

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

        {/* Mobile burger button on login screen */}
        {isMobile && (
          <div 
            onClick={() => setIsSidePanelOpen(true)}
            style={{
              position: "fixed",
              top: "12px",
              right: "12px",
              cursor: "pointer",
              color: "white",
              fontSize: "28px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
              zIndex: 100
            }}
          >
            ☰
          </div>
        )}

        {/* Side Panel Drawer Backdrop Overlay (login) */}
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

        {/* Side Panel Drawer (login) */}
        {isMobile && (
          <div style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "280px",
            background: "rgba(20, 22, 28, 0.9)",
            backdropFilter: "blur(20px)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "-10px 0 32px rgba(0, 0, 0, 0.5)",
            zIndex: 110,
            transform: isSidePanelOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "flex",
            flexDirection: "column",
            padding: "24px 20px",
            color: "white"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{t("menu.settings")}</span>
              <div 
                onClick={() => setIsSidePanelOpen(false)}
                style={{ cursor: "pointer", fontSize: "18px", opacity: 0.6, padding: "4px" }}
              >
                ✕
              </div>
            </div>

            {/* Camera Mode */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>{t("menu.camera")}</h3>
              <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "3px" }}>
                <div 
                  onClick={() => { cameraModeRef.current = "2D"; setIsSidePanelOpen(false); }}
                  style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: "13px", fontWeight: 700, borderRadius: "6px", cursor: "pointer", background: cameraModeRef.current === "2D" ? "rgba(255,255,255,0.1)" : "transparent", color: cameraModeRef.current === "2D" ? "white" : "rgba(255,255,255,0.6)" }}
                >2D</div>
                <div 
                  onClick={() => { cameraModeRef.current = "3D"; setIsSidePanelOpen(false); }}
                  style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: "13px", fontWeight: 700, borderRadius: "6px", cursor: "pointer", background: cameraModeRef.current === "3D" ? "rgba(255,255,255,0.1)" : "transparent", color: cameraModeRef.current === "3D" ? "white" : "rgba(255,255,255,0.6)" }}
                >3D</div>
              </div>
            </div>

            {/* Control Mode */}
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>{t("menu.controls")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div 
                  onClick={() => { setControlMode("mouse"); controlModeRef.current = "mouse"; setIsSidePanelOpen(false); }}
                  style={{ padding: "12px", fontSize: "13px", fontWeight: 700, borderRadius: "8px", cursor: "pointer", background: controlMode === "mouse" ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.03)", border: controlMode === "mouse" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid rgba(255,255,255,0.05)", color: controlMode === "mouse" ? "#60a5fa" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span style={{ fontSize: "16px" }}>👆</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>{t("control.touchDrag")}</span>
                    <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>{t("control.touchDragDesc")}</span>
                  </div>
                </div>
                <div 
                  onClick={() => { handleTiltActivation(); setIsSidePanelOpen(false); }}
                  style={{ padding: "12px", fontSize: "13px", fontWeight: 700, borderRadius: "8px", cursor: "pointer", background: controlMode === "tilt" ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.03)", border: controlMode === "tilt" ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255,255,255,0.05)", color: controlMode === "tilt" ? "#f87171" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span style={{ fontSize: "16px" }}>📱</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span>{t("control.tilt")}</span>
                    <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>{t("control.tiltDesc")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin link */}
            <a 
              href="/admin"
              style={{
                marginTop: "auto",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "rgba(255,255,255,0.4)",
                fontSize: "12px",
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.03em"
              }}
            >
              <span style={{ fontSize: "14px" }}>⚙️</span> Admin Panel
            </a>
          </div>
        )}
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
          height: "190px",
          background: "#0c0c0f",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          zIndex: 90,
          display: "flex",
          alignItems: "flex-start",
          padding: "8px 12px",
          gap: "10px",
          boxSizing: "border-box"
        }}>
          {/* Left: Radar Canvas */}
          <div style={{ width: "160px", height: "160px", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "4px" }}>
            <canvas ref={minimapCanvasRef} width={160} height={160} style={{ display: "block" }} />
          </div>

          {/* Right: Title row + Player list column */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "170px" }}>
            {/* Title "Топ 3" + Burger Menu (same vertical level) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px", flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(255, 255, 255, 0.75)", fontSize: "13px", fontWeight: 800 }}>
                <span>🏆</span> {t("leaderboard.top")} 3
              </span>
              <div 
                onClick={() => setIsSidePanelOpen(true)}
                style={{
                  cursor: "pointer",
                  color: "white",
                  fontSize: "28px",
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none"
                }}
              >
                ☰
              </div>
            </div>
            {/* Player List */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <Leaderboard limit={3} alwaysOpen={true} noBackground={true} alignLeft={true} hideTitle={true} />
            </div>
          </div>
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

      {/* Side Panel Drawer (Right) */}
      {isMobile && (
        <div style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "280px",
          background: "rgba(20, 22, 28, 0.9)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "-10px 0 32px rgba(0, 0, 0, 0.5)",
          zIndex: 110,
          transform: isSidePanelOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          padding: "24px 20px",
          color: "white"
        }}>
          {/* Side Drawer Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{t("menu.title")}</span>
            <div 
              onClick={() => setIsSidePanelOpen(false)}
              style={{ cursor: "pointer", fontSize: "18px", opacity: 0.6, padding: "4px" }}
            >
              ✕
            </div>
          </div>

          {/* Section 1: Camera Mode */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>{t("menu.camera")}</h3>
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
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "10px", letterSpacing: "0.05em" }}>{t("menu.controls")}</h3>
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
                  <span>{t("control.touchDrag")}</span>
                  <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>{t("control.touchDragDesc")}</span>
                </div>
              </div>
              
              <div 
                onClick={() => {
                  handleTiltActivation();
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
                  <span>{t("control.tilt")}</span>
                  <span style={{ fontSize: "9px", opacity: 0.6, fontWeight: "normal" }}>{t("control.tiltDesc")}</span>
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
                  ⚙️ {t("control.gyroPermission")}
                </div>
              )}
            </div>
          </div>

          {/* Section 2.5: Leaderboard inside Side Panel */}
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column", 
            minHeight: "150px", 
            marginBottom: "20px",
            overflow: "hidden" 
          }}>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }} className="custom-scrollbar">
              <Leaderboard limit={10} alwaysOpen={true} noBackground={true} />
            </div>
          </div>
 
          {/* Section 3: Help Instructions */}
          <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px" }}>
            <h3 style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.4)", fontWeight: 700, textTransform: "uppercase", marginBottom: "12px", letterSpacing: "0.05em" }}>{t("menu.guide")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
              {controlMode === "mouse" ? (
                <>
                  <div>• {t("guide.touchSteer")}</div>
                  <div>• {t("guide.touchBoost")}</div>
                </>
              ) : (
                <>
                  <div>• {t("guide.tiltSteer")}</div>
                  <div>• {t("guide.tiltBoost")}</div>
                </>
              )}
              <div>• {t("guide.collectFood")}</div>
              <div>• {t("guide.collision")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar Panel (Header HUD + Killfeed) */}
      <div style={{ position: "absolute", top: isMobile ? 254 : 20, left: isMobile ? 12 : 20, zIndex: 50, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
        
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

      {/* Таблица лидеров (Справа сверху, только для десктопа) */}
      {!isMobile && (
        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 50 }}>
          <Leaderboard />
        </div>
      )}

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
                <span>⌨️</span> {t("help.controls")}
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
                    {controlMode === "keyboard" ? t("help.steeringKbd") : t("help.steeringMouse")}
                  </kbd>
                  <span>— {t("help.steering")}</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#fafafa" }}>
                    {t("help.space")}
                  </kbd>
                  <span>— {t("help.boost")}</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#fafafa" }}>
                    C
                  </kbd>
                  <span>— {t("help.cameraSwitch")}</span>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <kbd style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.35)", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: "bold", color: "#60a5fa" }}>
                    T
                  </kbd>
                  <span>
                    — {t("help.mode")}: <strong style={{ color: "#60a5fa", fontWeight: "normal" }}>{controlMode === "keyboard" ? t("help.keyboard") : t("help.mouse")}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Фид очков еды (Отображается над панелью подсказок/бустом) */}
        <div id="hud-score-feed" style={{ display: "flex", flexDirection: "column", gap: "4px", pointerEvents: "none" }} />
      </div>

      {/* Шкала-индикатор поворота (По центру снизу, прижатая к самому низу) */}
      {(controlMode === "mouse" || controlMode === "tilt") && (
        <div 
          style={{
            position: "absolute",
            bottom: isMobile ? "90px" : "0px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 24px",
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

      {/* Mobile Boost Zone (unified for both touch drag and tilt modes, positioned BELOW the game canvas) */}
      {isMobile && (controlMode === "mouse" || controlMode === "tilt") && connectionStatus === "connected" && (
        <div 
          id="mobile-boost-zone"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "90px",
            background: "linear-gradient(to bottom, #e63946 0%, #2b2d34 100%)",
            borderTop: "3px dashed rgba(230, 57, 70, 0.5)",
            pointerEvents: "none",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textShadow: "0 0 1px #000, 0 1px 1px #000, 0 1px 2px #000, 0 2px 3px #000"
          }}
        >
          {t("boost.label")}
        </div>
      )}

      <div style={{ 
        position: "absolute", 
        bottom: isMobile ? "12px" : "182px", 
        right: isMobile ? "12px" : "20px", 
        zIndex: 50, 
        pointerEvents: "none",
        textAlign: "right"
      }}>
        <span 
          id="hud-ping"
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "#f87171",
            textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000"
          }}
        >
          offline
        </span>
      </div>

      {/* Debug HUD Overlay */}
      {debugMode && (
        <div 
          id="debug-hud"
          style={{
            position: "absolute",
            top: isMobile ? "200px" : "240px",
            right: isMobile ? "12px" : "20px",
            zIndex: 100,
            width: isMobile ? "180px" : "240px",
            background: "rgba(20, 22, 28, 0.75)",
            border: "1px solid rgba(230, 57, 70, 0.25)",
            borderRadius: "16px",
            padding: "12px 16px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(230, 57, 70, 0.1)",
            color: "white",
            fontSize: "12px",
            pointerEvents: "auto",
            transition: "all 0.3s ease",
          }}
        />
      )}

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
        minimapCanvasRef={minimapCanvasRef}
        debugMode={debugMode}
        workerRef={workerRef}
        latestFrameDataRef={latestFrameDataRef}
        isWaitingForFrameRef={isWaitingForFrameRef}
      />
    </div>
  );
}
