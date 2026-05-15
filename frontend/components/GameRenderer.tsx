import React, { useEffect, useRef } from "react";
import { GameState } from "../types/game";
import * as PIXI from "pixi.js";

const DEFAULT_SERVER_TICK_RATE = 30;
const TURN_SPEED_PER_SECOND = 5.0;
const TURN_IDLE_SMOOTHING_AT_20HZ = 0.3;
const TURN_ACTIVE_SMOOTHING_AT_20HZ = 0.15;
const frameSmoothing = (smoothingAt20Hz: number, dt: number) =>
  1 - ((1 - smoothingAt20Hz) ** (dt / 0.05));

interface GameRendererProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  lastGameStateRef: React.MutableRefObject<GameState | null>;
  lastUpdateTimeRef: React.MutableRefObject<number>;
  myIdRef: React.MutableRefObject<string>;
  cameraModeRef: React.MutableRefObject<"2D" | "3D">;
  localInputRef: React.MutableRefObject<{ turn: number; accelerating: boolean }>;
}

export const GameRenderer: React.FC<GameRendererProps> = ({
  gameStateRef,
  lastGameStateRef,
  lastUpdateTimeRef,
  myIdRef,
  cameraModeRef,
  localInputRef,
}) => {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const fogOverlayRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const worldContainerRef = useRef<PIXI.Container | null>(null);

  // Вспомогательная функция для HSL -> HEX (PixiJS использует числа 0xFFFFFF)
  const hslToHex = (h: number, s: number, l: number) => {
    h = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return (Math.round(f(0) * 255) << 16) + (Math.round(f(8) * 255) << 8) + Math.round(f(4) * 255);
  };

  useEffect(() => {
    let animationFrameId: number;
    let currentZoomOffset = 0;
    let lastFrameTime = performance.now();
    let localAngle: number | null = null;
    let localCurrentTurn = 0;
    let isDestroyed = false;
    let cameraTransition = cameraModeRef.current === "3D" ? 1.0 : 0.0;

    const initPixi = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: window.innerWidth * 2,
        height: window.innerHeight,
        backgroundColor: 0x222222,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true, // Включаем сглаживание для красивых змеек
      });

      if (isDestroyed) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      if (pixiContainerRef.current) {
        pixiContainerRef.current.appendChild(app.canvas);
        app.canvas.style.position = "absolute";
        app.canvas.style.top = "0";
        app.canvas.style.left = "0";
      }
      appRef.current = app;

      const worldContainer = new PIXI.Container();
      app.stage.addChild(worldContainer);
      worldContainerRef.current = worldContainer;

      const g = new PIXI.Graphics();
      worldContainer.addChild(g);
      graphicsRef.current = g;

      // Инициируем вызов цикла отрисовки
      lastFrameTime = performance.now();
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const drawGame = (dt: number) => {
      if (!appRef.current || !graphicsRef.current || !worldContainerRef.current) return;
      
      const app = appRef.current;
      const canvas = app.canvas;
      const g = graphicsRef.current;
      const worldContainer = worldContainerRef.current;
      
      const minimapCanvas = minimapCanvasRef.current;
      if (!minimapCanvas) return;
      const miniCtx = minimapCanvas.getContext("2d");
      if (!miniCtx) return;

      const state = gameStateRef.current;
      if (!state) return;
      const serverSimulation = state.server_simulation;
      const serverTickRate = serverSimulation?.tick_rate || state.server_tick_rate || DEFAULT_SERVER_TICK_RATE;
      const serverTickMs = 1000 / serverTickRate;
      const turnSpeedPerSecond = serverSimulation?.turn_speed_per_second || TURN_SPEED_PER_SECOND;
      const turnIdleSmoothing = serverSimulation?.turn_idle_smoothing_at_20hz ?? TURN_IDLE_SMOOTHING_AT_20HZ;
      const turnActiveSmoothing = serverSimulation?.turn_active_smoothing_at_20hz ?? TURN_ACTIVE_SMOOTHING_AT_20HZ;
      const lastState = lastGameStateRef.current;
      const myId = myIdRef.current;

      const WORLD_WIDTH = 100;
      const WORLD_HEIGHT = 100;
      const gridSize = 20;

      const targetTransition = cameraModeRef.current === "3D" ? 1.0 : 0.0;
      cameraTransition += (targetTransition - cameraTransition) * dt * 6.0;
      if (Math.abs(targetTransition - cameraTransition) < 0.005) cameraTransition = targetTransition;

      const containerW = pixiContainerRef.current?.clientWidth || window.innerWidth;
      const containerH = pixiContainerRef.current?.clientHeight || window.innerHeight;
      const currentLogicalWidth = containerW * 2;
      const currentLogicalHeight = containerH;

      // Масштабирование (Anti-Cheat & Responsiveness): 
      // Фиксируем максимальную видимую область логических пикселей независимо от монитора
      const BASE_VIEWPORT_WIDTH = 1600;
      const BASE_VIEWPORT_HEIGHT = 800;
      const resolutionScale = Math.max(containerW / BASE_VIEWPORT_WIDTH, containerH / BASE_VIEWPORT_HEIGHT);

      if (app.renderer.screen.width !== currentLogicalWidth || app.renderer.screen.height !== currentLogicalHeight) {
        app.renderer.resize(currentLogicalWidth, currentLogicalHeight);
      }

      const now = performance.now();
      const progress = lastUpdateTimeRef.current === 0 ? 1 : Math.min((now - lastUpdateTimeRef.current) / serverTickMs, 2.0);

      let camX = (WORLD_WIDTH * gridSize) / 2;
      let camY = (WORLD_HEIGHT * gridSize) / 2;
      let camAngle = 0;
      const myPlayer = state.players[myId];

      if (myPlayer) {
        if (localAngle === null) {
          localAngle = myPlayer.angle;
        }

        const targetTurn = localInputRef.current.turn * (turnSpeedPerSecond / serverTickRate);
        if (localInputRef.current.turn === 0) {
          localCurrentTurn += (0 - localCurrentTurn) * frameSmoothing(turnIdleSmoothing, dt);
        } else {
          localCurrentTurn += (targetTurn - localCurrentTurn) * frameSmoothing(turnActiveSmoothing, dt);
        }
        localAngle += localCurrentTurn * dt * serverTickRate;

        const angleDiff = Math.atan2(Math.sin(myPlayer.angle - localAngle), Math.cos(myPlayer.angle - localAngle));
        if (Math.abs(angleDiff) > Math.PI / 2) {
          localAngle = myPlayer.angle;
        } else {
          localAngle += angleDiff * 0.1; 
        }

        if (myPlayer.accelerating || localInputRef.current.accelerating) {
          currentZoomOffset += 3.0 * dt; 
          if (currentZoomOffset > 1) currentZoomOffset = 1;
        } else {
          currentZoomOffset -= 3.0 * dt;
          if (currentZoomOffset < 0) currentZoomOffset = 0;
        }
      }

      if (myPlayer && myPlayer.body.length > 0) {
        const target = myPlayer.body[0];
        let start = target;
        const oldBody = lastState?.players[myId]?.body;

        if (oldBody && oldBody.length > 0) start = oldBody[0];
        if (Math.abs(target.x - start.x) > 50 || Math.abs(target.y - start.y) > 50) start = target;

        camX = (start.x + (target.x - start.x) * progress) * gridSize + gridSize / 2;
        camY = (start.y + (target.y - start.y) * progress) * gridSize + gridSize / 2;
        
        camAngle = localAngle!;
      }

      const basePerspective = Math.max(800, containerH);
      const currentPerspective = basePerspective - 500 * cameraTransition - currentZoomOffset * 80 * cameraTransition;
      const currentScale = 1.0 + 0.4 * cameraTransition - currentZoomOffset * 0.2 * cameraTransition;
      const currentTilt = (55 + currentZoomOffset * 7) * cameraTransition;

      canvas.style.width = "200%";
      canvas.style.height = "100%";
      canvas.style.left = "-50%";
      
      if (cameraTransition > 0.01) {
        canvas.style.transform = `perspective(${currentPerspective}px) rotateX(${currentTilt}deg) scale(${currentScale})`;
        canvas.style.transformOrigin = "50% 75%";
        if (fogOverlayRef.current) {
          // Плавно опускаем туман сверху вниз (от -100% до 0%) синхронно с переходом
          fogOverlayRef.current.style.transform = `translateY(${-100 * (1 - cameraTransition)}%)`;
          fogOverlayRef.current.style.opacity = "1";
        }
      } else {
        canvas.style.transform = "none";
        if (fogOverlayRef.current) {
          fogOverlayRef.current.style.transform = "translateY(-100%)";
          fogOverlayRef.current.style.opacity = "0";
        }
      }

      miniCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
      g.clear();
      
      const zoom2D = 1.0 - currentZoomOffset * 0.05;
      const targetContainerScale = (zoom2D + (1 - zoom2D) * cameraTransition) * resolutionScale;
      const targetContainerY = currentLogicalHeight / 2 + (currentLogicalHeight * 0.75 - currentLogicalHeight / 2) * cameraTransition;
      
      const baseRot = -camAngle - Math.PI / 2;
      let targetZero = baseRot;
      while (targetZero > Math.PI) targetZero -= Math.PI * 2;
      while (targetZero < -Math.PI) targetZero += Math.PI * 2;
      targetZero = baseRot - targetZero; // Вычисляем ближайший кратный ноль для плавного вращения без рывков
      
      worldContainer.position.set(currentLogicalWidth / 2, targetContainerY);
      worldContainer.rotation = targetZero + (baseRot - targetZero) * cameraTransition;
      worldContainer.scale.set(targetContainerScale, targetContainerScale);
      worldContainer.pivot.set(camX, camY);

      g.rect(0, 0, WORLD_WIDTH * gridSize, WORLD_HEIGHT * gridSize).fill(0xfafafa);

      const viewRadius = (1000 + 800 * cameraTransition) / zoom2D;
      const minX = Math.max(0, camX - viewRadius);
      const maxX = Math.min(WORLD_WIDTH * gridSize, camX + viewRadius);
      const minY = Math.max(0, camY - viewRadius);
      const maxY = Math.min(WORLD_HEIGHT * gridSize, camY + viewRadius);

      g.beginPath();
      let startCol = Math.floor(minX / gridSize);
      if (startCol % 2 !== 0) startCol = Math.max(0, startCol - 1);
      const endCol = Math.min(WORLD_WIDTH, Math.ceil(maxX / gridSize));
      
      let startRow = Math.floor(minY / gridSize);
      if (startRow % 2 !== 0) startRow = Math.max(0, startRow - 1);
      const endRow = Math.min(WORLD_HEIGHT, Math.ceil(maxY / gridSize));

      for (let i = startCol; i <= endCol; i += 2) {
        g.moveTo(i * gridSize, minY);
        g.lineTo(i * gridSize, maxY);
      }
      for (let i = startRow; i <= endRow; i += 2) {
        g.moveTo(minX, i * gridSize);
        g.lineTo(maxX, i * gridSize);
      }
      g.stroke({ width: 1, color: 0xe5e5e5 });

      g.rect(0, 0, WORLD_WIDTH * gridSize, WORLD_HEIGHT * gridSize).stroke({ width: 15, color: 0x64c8ff, alpha: 0.4 });
      g.rect(0, 0, WORLD_WIDTH * gridSize, WORLD_HEIGHT * gridSize).stroke({ width: 5, color: 0xc8f0ff, alpha: 0.8 });

      if (state.foods) {
        const foodsLen = state.foods.length;
        for (let i = 0; i < foodsLen; i++) {
          const food = state.foods[i];
          const fx = food.x * gridSize + gridSize / 2;
          const fy = food.y * gridSize + gridSize / 2;
          if (fx < minX || fx > maxX || fy < minY || fy > maxY) continue;

          const foodRadius = gridSize * (0.2 + Math.sqrt(food.value) * 0.1);
          
          let glowColor = 0xef4444;
          let mainColor = 0xef4444;
          
          if (food.value >= 50) { mainColor = 0xa855f7; glowColor = 0xa855f7; }
          else if (food.value >= 20) { mainColor = 0x3b82f6; glowColor = 0x3b82f6; }
          else if (food.value >= 10) { mainColor = 0x4ade80; glowColor = 0x4ade80; }
          else if (food.value >= 5) { mainColor = 0xfbbf24; glowColor = 0xfbbf24; }
          else if (food.value >= 2) { mainColor = 0xf97316; glowColor = 0xf97316; }

          if (food.value >= 2) {
            g.circle(fx, fy, foodRadius * 1.6).fill({ color: glowColor, alpha: 0.4 });
          }
          // Тень (Ambient Occlusion - без смещения, чуть шире радиуса еды)
          g.circle(fx, fy, foodRadius * 1.2).fill({ color: 0x000000, alpha: 0.15 });
          // Основной круг
          g.circle(fx, fy, foodRadius).fill({ color: mainColor });
        }
      }

      const parseColor = (colorStr: string) => parseInt(colorStr.replace('#', '0x'), 16) || 0x22c55e;

      if (state.players) {
        for (const playerId in state.players) {
          const playerData = state.players[playerId];
          const body = playerData.body;
          const oldBody = lastState?.players[playerId]?.body;
          const score = playerData.score || 30;

          const snakeRadius = gridSize * (0.2 + score * 0.0005);

          // Подготавливаем массивы координат
          const pointsX: number[] = [];
          const pointsY: number[] = [];
          const logicalX: number[] = [];
          const logicalY: number[] = [];

          for (let i = 0; i < body.length; i++) {
            const target = body[i];
            let start = target;

            if (oldBody) {
              start = oldBody[i] || oldBody[oldBody.length - 1] || target;
            }

            if (Math.abs(target.x - start.x) > 50 || Math.abs(target.y - start.y) > 50) {
              start = target;
            }

            const currentX = start.x + (target.x - start.x) * progress;
            const currentY = start.y + (target.y - start.y) * progress;

            logicalX.push(currentX);
            logicalY.push(currentY);
            pointsX.push(currentX * gridSize + gridSize / 2);
            pointsY.push(currentY * gridSize + gridSize / 2);
          }

          const headPx = pointsX[0];
          const headPy = pointsY[0];

          // 1. Отрисовка тени (Ambient Occlusion - без смещения, чуть шире тела)
          if (pointsX.length > 1) {
            g.beginPath();
            g.moveTo(pointsX[0], pointsY[0]);
            for (let i = 1; i < pointsX.length; i++) {
              if (Math.abs(logicalX[i] - logicalX[i - 1]) <= 1.5 && Math.abs(logicalY[i] - logicalY[i - 1]) <= 1.5) {
                g.lineTo(pointsX[i], pointsY[i]);
              } else {
                g.moveTo(pointsX[i], pointsY[i]);
              }
            }
            g.stroke({ width: snakeRadius * 2.4, color: 0x000000, alpha: 0.15, cap: 'round', join: 'round' });
          } else if (pointsX.length === 1) {
            g.circle(headPx, headPy, snakeRadius * 1.2).fill({ color: 0x000000, alpha: 0.15 });
          }

          // 2. Отрисовка тела змеи
          for (let i = 1; i < pointsX.length; i++) {
            if (Math.abs(logicalX[i] - logicalX[i - 1]) <= 1.5 && Math.abs(logicalY[i] - logicalY[i - 1]) <= 1.5) {
              let segColor = parseColor(playerData.skin || "#22c55e");
              const skin = playerData.skin;
              if (skin === "zebra") segColor = i % 2 === 0 ? 0xe5e5e5 : 0x171717;
              else if (skin === "rainbow") segColor = hslToHex(i * 15 - now / 20, 1, 0.5);
              else if (skin === "tiger") segColor = i % 3 === 0 ? 0x171717 : 0xf97316;
              else if (skin === "cyberpunk") segColor = i % 2 === 0 ? 0xff00ff : 0x00ffff;
              
              g.beginPath();
              g.moveTo(pointsX[i - 1], pointsY[i - 1]);
              g.lineTo(pointsX[i], pointsY[i]);
              g.stroke({ width: snakeRadius * 2, color: segColor, cap: 'round', join: 'round' });
            }
          }
          
          if (body.length === 1) {
            let segColor = parseColor(playerData.skin || "#22c55e");
            const skin = playerData.skin;
            if (skin === "zebra") segColor = 0xe5e5e5;
            else if (skin === "rainbow") segColor = hslToHex(-now / 20, 1, 0.5);
            else if (skin === "tiger") segColor = 0xf97316;
            else if (skin === "cyberpunk") segColor = 0xff00ff;

            g.circle(headPx, headPy, snakeRadius).fill(segColor);
          }

          const eyeOffset = snakeRadius * 0.6;
          let currentAngle = 0;
          
          if (playerId === myId && localAngle !== null) {
            currentAngle = localAngle; // Используем предсказанный локальный угол
          } else {
            const targetAngle = playerData.angle;
            const startAngle = lastState?.players[playerId]?.angle ?? targetAngle;
            currentAngle = startAngle + (targetAngle - startAngle) * progress;
          }
          
          const e1x = headPx + Math.cos(currentAngle - Math.PI / 2.5) * eyeOffset;
          const e1y = headPy + Math.sin(currentAngle - Math.PI / 2.5) * eyeOffset;
          
          const e2x = headPx + Math.cos(currentAngle + Math.PI / 2.5) * eyeOffset;
          const e2y = headPy + Math.sin(currentAngle + Math.PI / 2.5) * eyeOffset;
          
          const px1 = Math.cos(currentAngle) * (snakeRadius * 0.3);
          const py1 = Math.sin(currentAngle) * (snakeRadius * 0.3);

          const eyeSize = snakeRadius * 0.4;
          g.circle(e1x, e1y, eyeSize).fill(0xffffff);
          g.circle(e2x, e2y, eyeSize).fill(0xffffff);

          const pupilSize = snakeRadius * 0.2;
          g.circle(e1x + px1, e1y + py1, pupilSize).fill(0x000000);
          g.circle(e2x + px1, e2y + py1, pupilSize).fill(0x000000);
        }
      }

      if (state.players && state.foods) {
        const mapSize = 150;
        const mapScale = mapSize / WORLD_WIDTH;

        miniCtx.save();

        if (cameraTransition > 0.5) {
          const mapCenterX = mapSize / 2;
          const mapCenterY = mapSize / 2;
          const mapRadius = mapSize / 2;

          miniCtx.beginPath();
          miniCtx.arc(mapCenterX, mapCenterY, mapRadius, 0, Math.PI * 2);
          miniCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
          miniCtx.fill();
          miniCtx.lineWidth = 2;
          miniCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          miniCtx.stroke();
          
          miniCtx.clip();

          miniCtx.translate(mapCenterX, mapCenterY);
          miniCtx.rotate(-camAngle - Math.PI / 2);
          
          const mapCamX = (camX / gridSize) * mapScale;
          const mapCamY = (camY / gridSize) * mapScale;
          miniCtx.translate(-mapCamX, -mapCamY);

          const foodsLen = state.foods.length;
          for (let i = 0; i < foodsLen; i++) {
            const food = state.foods[i];
            let dotSize = 2;
            if (food.value >= 50) { miniCtx.fillStyle = "rgba(168, 85, 247, 0.8)"; dotSize = 5; }
            else if (food.value >= 20) { miniCtx.fillStyle = "rgba(59, 130, 246, 0.8)"; dotSize = 4; }
            else if (food.value >= 10) { miniCtx.fillStyle = "rgba(74, 222, 128, 0.8)"; dotSize = 3.5; }
            else if (food.value >= 5) { miniCtx.fillStyle = "rgba(251, 191, 36, 0.8)"; dotSize = 3; }
            else if (food.value >= 2) { miniCtx.fillStyle = "rgba(249, 115, 22, 0.8)"; dotSize = 2.5; }
            else { miniCtx.fillStyle = "rgba(239, 68, 68, 0.5)"; dotSize = 2; }
            miniCtx.fillRect(food.x * mapScale - dotSize / 2, food.y * mapScale - dotSize / 2, dotSize, dotSize);
          }

          for (const playerId in state.players) {
            const playerData = state.players[playerId];
            if (playerData.body.length === 0) continue;
            const head = playerData.body[0];
            let headColor = playerData.skin || "#22c55e";
            if (headColor === "zebra") headColor = "#ffffff";
            else if (headColor === "rainbow") headColor = "#a855f7";
            else if (headColor === "tiger") headColor = "#f97316";
            else if (headColor === "cyberpunk") headColor = "#0ff";

            miniCtx.fillStyle = headColor;
            miniCtx.beginPath();
            miniCtx.arc(head.x * mapScale, head.y * mapScale, playerId === myId ? 4 : 2, 0, Math.PI * 2);
            miniCtx.fill();
          }
        } else {
          miniCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
          miniCtx.fillRect(0, 0, mapSize, mapSize);
          miniCtx.lineWidth = 2;
          miniCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
          miniCtx.strokeRect(0, 0, mapSize, mapSize);

          const foodsLen = state.foods.length;
          for (let i = 0; i < foodsLen; i++) {
            const food = state.foods[i];
            let dotSize = 2;
            if (food.value >= 50) { miniCtx.fillStyle = "rgba(168, 85, 247, 0.8)"; dotSize = 5; }
            else if (food.value >= 20) { miniCtx.fillStyle = "rgba(59, 130, 246, 0.8)"; dotSize = 4; }
            else if (food.value >= 10) { miniCtx.fillStyle = "rgba(74, 222, 128, 0.8)"; dotSize = 3.5; }
            else if (food.value >= 5) { miniCtx.fillStyle = "rgba(251, 191, 36, 0.8)"; dotSize = 3; }
            else if (food.value >= 2) { miniCtx.fillStyle = "rgba(249, 115, 22, 0.8)"; dotSize = 2.5; }
            else { miniCtx.fillStyle = "rgba(239, 68, 68, 0.5)"; dotSize = 2; }
            miniCtx.fillRect(food.x * mapScale - dotSize / 2, food.y * mapScale - dotSize / 2, dotSize, dotSize);
          }

          for (const playerId in state.players) {
            const playerData = state.players[playerId];
            if (playerData.body.length === 0) continue;
            const head = playerData.body[0];
            let headColor = playerData.skin || "#22c55e";
            if (headColor === "zebra") headColor = "#ffffff";
            else if (headColor === "rainbow") headColor = "#a855f7";
            else if (headColor === "tiger") headColor = "#f97316";
            else if (headColor === "cyberpunk") headColor = "#0ff";

            miniCtx.fillStyle = headColor;
            miniCtx.beginPath();
            miniCtx.arc(head.x * mapScale, head.y * mapScale, playerId === myId ? 4 : 2, 0, Math.PI * 2);
            miniCtx.fill();
          }
        }

        miniCtx.restore();
      }
    };

    const renderLoop = (time: number) => {
      let dt = (time - lastFrameTime) / 1000;
      if (dt > 0.1) dt = 0.1;
      
      lastFrameTime = time;
      drawGame(dt);
      if (!isDestroyed) {
        animationFrameId = requestAnimationFrame(renderLoop);
      }
    };
    
    initPixi();

    return () => {
      isDestroyed = true;
      cancelAnimationFrame(animationFrameId);
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
  }, [gameStateRef, lastGameStateRef, lastUpdateTimeRef, myIdRef, cameraModeRef, localInputRef]);

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#222" }}>
      
      {/* Контейнер для PixiJS */}
      <div ref={pixiContainerRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }} />
        
      {/* Оптимизированный 3D-туман через CSS Overlay */}
      <div 
        ref={fogOverlayRef} 
        style={{ 
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%", 
          pointerEvents: "none", zIndex: 10, opacity: 0, transform: "translateY(-100%)",
          background: "linear-gradient(to bottom, rgba(34,34,34,1) 0%, rgba(34,34,34,1) 49%, rgba(34,34,34,0) 55%)"
        }} 
      />

      <div style={{ position: "absolute", bottom: 20, right: 20, display: "flex", gap: "20px", zIndex: 50, pointerEvents: "none", alignItems: "flex-end" }}>
        <div style={{ pointerEvents: "auto" }}>
          <canvas
            ref={minimapCanvasRef}
            width={150}
            height={150}
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
};;;
