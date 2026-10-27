// ROLE: Lazy game UI bootstrap (login, HUD, game lifecycle). Not network or renderer logic.

import { GameOverScreen } from "../ui/GameOverScreen";
import { HUD } from "../ui/HUD";
import { KillFeed } from "../ui/KillFeed";
import { Leaderboard } from "../ui/Leaderboard";
import { LoginScreen } from "../ui/LoginScreen";
import { Minimap } from "../ui/Minimap";
import { MobileControls } from "../ui/MobileControls";
import { SettingsPanel } from "../ui/SettingsPanel";
import { SteeringIndicator } from "../ui/SteeringIndicator";
import { Game } from "./Game";

export function showLoginScreen(app: HTMLDivElement): void {
  app.replaceChildren();
  const login = new LoginScreen(app, (nickname, skin) => {
    login.hide();
    launchGame(app, nickname, skin);
  });
}

function launchGame(app: HTMLDivElement, nickname: string, skin: string): void {
  const canvasContainer = document.createElement("div");
  canvasContainer.id = "game-canvas-container";
  canvasContainer.classList.add("game-canvas-container");
  app.appendChild(canvasContainer);

  const hudContainer = document.createElement("div");
  hudContainer.className = "hud-container";
  app.appendChild(hudContainer);

  const game = new Game(canvasContainer);

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("debug") === "true") {
    game.toggleDebug();
  }

  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

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

  const settings = new SettingsPanel(hudContainer, game.getInputManager(), {
    onDebugToggle: () => {
      game.toggleDebug();
    },
    onAdminClick: () => {
      window.location.search = "?admin=true";
    },
    onFpsToggle: (enabled: boolean) => {
      game.setStatsEnabled(enabled);
    },
  });

  window.addEventListener("game-ping", () => {}); // placeholder for potential future listener

  (game as any).renderOrchestrator.onPostRender((frame: any, myId: string) => {
    const turn = game.getInputManager().getTurn();
    const mode = game.getInputManager().getControlMode();
    steering.update(turn, mode);

    if (frame) {
      minimap.update(frame, myId, isMobile);

      const myPlayer = frame.gameState?.players?.[myId];
      gameOverScreen.setMyId(myId);

      if (myPlayer) {
        const lastScore = (hud as any).lastScore || 0;
        if (myPlayer.score !== lastScore) {
          window.dispatchEvent(
            new CustomEvent("game-score-update", {
              detail: { score: myPlayer.score, delta: myPlayer.score - lastScore },
            }),
          );
          (hud as any).lastScore = myPlayer.score;
        }
      }
    }
  });

  game.start(nickname, skin);

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
