// ROLE: Точка входа приложения. Не содержит игровой логики.
import "./styles/main.css";
import "./styles/login.css";
import "./styles/hud_score.css";
import "./styles/hud.css";
import "./styles/admin.css";
import "./styles/minimap.css";
import "./styles/settings.css";

import { LoginScreen } from "./ui/LoginScreen";
import { Game } from "./game/Game";
import { HUD } from "./ui/HUD";
import { Leaderboard } from "./ui/Leaderboard";
import { KillFeed } from "./ui/KillFeed";
import { SteeringIndicator } from "./ui/SteeringIndicator";
import { Minimap } from "./ui/Minimap";
import { GameOverScreen } from "./ui/GameOverScreen";
import { MobileControls } from "./ui/MobileControls";
import { SettingsPanel } from "./ui/SettingsPanel";
import { AdminPanel } from "./admin/AdminPanel";

document.addEventListener("DOMContentLoaded", () => {
  // Prevent pinch-to-zoom gestures on iOS devices
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());

  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin = urlParams.has("admin") || window.location.pathname.startsWith("/admin");

  if (isAdmin) {
    new AdminPanel(app);
  } else {
    showLoginScreen(app);
  }
});

function showLoginScreen(app: HTMLDivElement): void {
  const login = new LoginScreen(app, (nickname, skin) => {
    login.hide();
    launchGame(app, nickname, skin);
  });
}

function launchGame(app: HTMLDivElement, nickname: string, skin: string): void {
  // 1. Create Canvas Container
  const canvasContainer = document.createElement("div");
  canvasContainer.id = "game-canvas-container";
  canvasContainer.classList.add("game-canvas-container");
  app.appendChild(canvasContainer);

  // 2. Create HUD Overlay Container
  const hudContainer = document.createElement("div");
  hudContainer.className = "hud-container";
  app.appendChild(hudContainer);

  // 3. Initialize Game Engine
  const game = new Game(canvasContainer);

  // 4. Initialize HUD Components
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

  const hud = new HUD(hudContainer);
  
  const leaderboardOptions = isMobile 
    ? { limit: 3, alwaysOpen: true, noBackground: true, hideHeader: true }
    : { limit: 10 };
    
  const leaderboard = new Leaderboard(hudContainer, leaderboardOptions);
  
  if (isMobile && document.querySelector(".leaderboard-panel")) {
    const panel = document.querySelector(".leaderboard-panel") as HTMLElement;
    
    const titleDiv = document.createElement("div");
    titleDiv.classList.add("mobile-leaderboard-title");
    titleDiv.innerHTML = "<span>🏆</span> Top 3";
    
    panel.insertBefore(titleDiv, panel.firstChild);
  }

  const killFeed = new KillFeed(hudContainer);
  const steering = new SteeringIndicator(hudContainer);
  const minimap = new Minimap(hudContainer);
  const gameOverScreen = new GameOverScreen(hudContainer, (game as any).networkManager);
  const mobile = new MobileControls(hudContainer, game.getInputManager());

  // 5. Initialize Settings Sidebar
  const settings = new SettingsPanel(hudContainer, game.getInputManager(), {
    onDebugToggle: () => {
      game.toggleDebug();
    },
    onAdminClick: () => {
      window.location.search = "?admin=true";
    }
  });

  // 6. Bind 60FPS update hook for steering indicator & minimap
  window.addEventListener("game-ping", () => {}); // placeholder for potential future listener
  
  // Intercept frame updates to draw minimap & steering bar
  (game as any).renderOrchestrator.onPostRender((frame: any, myId: string) => {
    const turn = game.getInputManager().getTurn();
    const mode = game.getInputManager().getControlMode();
    steering.update(turn, mode);

    if (frame) {
      minimap.update(frame, myId, isMobile);
      
      // Compute score delta to dispatch events for HUD
      const myPlayer = frame.gameState.players[myId];
      gameOverScreen.setMyId(myId);

      if (myPlayer) {
        const lastScore = (hud as any).lastScore || 0;
        if (myPlayer.score !== lastScore) {
          window.dispatchEvent(new CustomEvent("game-score-update", {
            detail: { score: myPlayer.score, delta: myPlayer.score - lastScore }
          }));
          (hud as any).lastScore = myPlayer.score;
        }
      }
    }
  });

  // 7. Start connection
  game.start(nickname, skin);

  // Register cleanups
  window.addEventListener("beforeunload", () => {
    game.destroy();
    hud.destroy();
    leaderboard.destroy();
    killFeed.destroy();
    steering.destroy();
    minimap.destroy();
    mobile.destroy();
    settings.destroy();
  });
}
