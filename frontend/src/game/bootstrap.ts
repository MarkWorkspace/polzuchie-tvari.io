// ROLE: Lazy game UI bootstrap (login, HUD, game lifecycle). Not network or renderer logic.

import { Minimap } from "../ui/Minimap";
import { MobileControls } from "../ui/MobileControls";
import { attachGameUiBridge } from "../ui/react/gameUiStore";
import { mountGameHud } from "../ui/react/mountGameHud";
import { mountGameOverScreen } from "../ui/react/mountGameOverScreen";
import { mountLoginScreen } from "../ui/react/mountLoginScreen";
import { mountSessionMovedScreen } from "../ui/react/mountSessionMovedScreen";
import { mountSettingsPanel } from "../ui/react/mountSettingsPanel";
import { SteeringIndicator } from "../ui/SteeringIndicator";
import { Game } from "./Game";
import { PlayerSessionLock } from "./PlayerSessionLock";

export function showLoginScreen(app: HTMLDivElement): void {
  app.replaceChildren();
  const sessionLock = new PlayerSessionLock();
  let unmountLogin: (() => void) | null = null;
  let stopGame: (() => void) | null = null;

  const beginGame = (nickname: string, skin: string): void => {
    stopGame?.();
    stopGame = null;
    unmountLogin?.();
    unmountLogin = null;
    stopGame = launchGame(app, nickname, skin);
  };

  sessionLock.onTakeOver(() => {
    stopGame?.();
    stopGame = null;
    unmountLogin?.();
    unmountLogin = null;
    sessionLock.dispose();
    mountSessionMovedScreen(app, {
      onReload: () => window.location.reload(),
      onSpectate: () => {
        window.location.search = "?spectator=true";
      },
    });
  });

  unmountLogin = mountLoginScreen(app, {
    onPlay: async (nickname, skin) => {
      if (!(await sessionLock.tryAcquire())) {
        return "busy";
      }
      try {
        beginGame(nickname, skin);
      } catch (error) {
        sessionLock.release();
        throw error;
      }
      return "started";
    },
    onTakeOver: async (nickname, skin) => {
      sessionLock.requestTakeOver();
      if (!(await sessionLock.acquireWhenAvailable(4000))) {
        return "timeout";
      }
      try {
        beginGame(nickname, skin);
      } catch (error) {
        sessionLock.release();
        throw error;
      }
      return "started";
    },
    onSpectate: () => {
      window.location.search = "?spectator=true";
    },
  });
}

function launchGame(app: HTMLDivElement, nickname: string, skin: string): () => void {
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

  const detachGameUi = attachGameUiBridge();
  const unmountHud = mountGameHud(hudContainer, isMobile);

  const steering = new SteeringIndicator(hudContainer);
  const minimap = new Minimap(hudContainer);
  const gameOverContainer = document.createElement("div");
  gameOverContainer.className = "game-over-root";
  hudContainer.appendChild(gameOverContainer);
  const unmountGameOver = mountGameOverScreen(gameOverContainer, game.networkManager, () =>
    game.getMyId(),
  );
  const mobile = new MobileControls(hudContainer, game.getInputManager());

  const settingsContainer = document.createElement("div");
  app.appendChild(settingsContainer);
  const unmountSettings = mountSettingsPanel(
    settingsContainer,
    game.getInputManager(),
    {
      onAdminClick: () => {
        window.location.search = "?admin=true";
      },
      onFpsToggle: (enabled: boolean) => {
        game.setStatsEnabled(enabled);
      },
    },
    game,
  );

  let lastScore = 0;

  (game as any).renderOrchestrator.onPostRender((frame: any, myId: string) => {
    const turn = game.getInputManager().getTurn();
    const mode = game.getInputManager().getControlMode();
    steering.update(turn, mode);

    if (frame) {
      minimap.update(frame, myId, isMobile);

      const myPlayer = frame.gameState?.players?.[myId];

      if (myPlayer) {
        if (myPlayer.score !== lastScore) {
          window.dispatchEvent(
            new CustomEvent("game-score-update", {
              detail: { score: myPlayer.score, delta: myPlayer.score - lastScore },
            }),
          );
          lastScore = myPlayer.score;
        }
      }
    }
  });

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("beforeunload", stop);
    game.destroy();
    unmountGameOver();
    unmountHud();
    detachGameUi();
    steering.destroy();
    minimap.destroy();
    mobile.destroy();
    unmountSettings();
    canvasContainer.remove();
    hudContainer.remove();
    settingsContainer.remove();
  };

  try {
    game.start(nickname, skin);
  } catch (error) {
    stop();
    throw error;
  }
  window.addEventListener("beforeunload", stop);
  return stop;
}
