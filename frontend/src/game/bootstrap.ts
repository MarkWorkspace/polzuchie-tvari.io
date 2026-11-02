// ROLE: Lazy game UI bootstrap (login, HUD, game lifecycle). Not network or renderer logic.

import { t } from "../lib/i18n";
import { Minimap } from "../ui/Minimap";
import { MobileControls } from "../ui/MobileControls";
import { attachGameUiBridge } from "../ui/react/gameUiStore";
import { mountGameErrorOverlay } from "../ui/react/mountGameErrorOverlay";
import { mountGameHud } from "../ui/react/mountGameHud";
import { mountGameOverScreen } from "../ui/react/mountGameOverScreen";
import { mountLoginScreen } from "../ui/react/mountLoginScreen";
import { mountSessionMovedScreen } from "../ui/react/mountSessionMovedScreen";
import { mountSettingsPanel } from "../ui/react/mountSettingsPanel";
import { SteeringIndicator } from "../ui/SteeringIndicator";
import { Game } from "./Game";
import { PlayerSessionLock } from "./PlayerSessionLock";

export type RuntimeSupport = { ok: true } | { ok: false; reason: "worker" | "webgl2" };

export interface RuntimeSupportProbe {
  hasWorker?: boolean;
  getWebGL2Context?: () => unknown | null;
}

/**
 * Fail before the login screen if the runtime cannot host the game. Feature
 * detection is injectable so the probe stays testable without a real browser.
 */
export function checkRuntimeSupport(probe: RuntimeSupportProbe = {}): RuntimeSupport {
  const hasWorker = probe.hasWorker ?? typeof Worker !== "undefined";
  if (!hasWorker) return { ok: false, reason: "worker" };

  const getWebGL2Context =
    probe.getWebGL2Context ??
    (() => {
      if (typeof document === "undefined") return null;
      return document.createElement("canvas").getContext("webgl2");
    });

  try {
    return getWebGL2Context() ? { ok: true } : { ok: false, reason: "webgl2" };
  } catch {
    return { ok: false, reason: "webgl2" };
  }
}

/** Blocking overlay instead of a login screen that can never start the game. */
function showStartupError(app: HTMLDivElement, title: string, message: string): void {
  app.replaceChildren();
  const overlay = mountGameErrorOverlay(app, { title, message });
  overlay.show();
}

export function showLoginScreen(app: HTMLDivElement): void {
  const support = checkRuntimeSupport();
  if (!support.ok) {
    showStartupError(
      app,
      t("error.title"),
      support.reason === "worker" ? t("error.workerUnsupported") : t("error.webglUnsupported"),
    );
    return;
  }

  app.replaceChildren();
  const sessionLock = new PlayerSessionLock();
  let unmountLogin: (() => void) | null = null;
  let stopGame: (() => void) | null = null;

  const beginGame = (nickname: string, skin: string): void => {
    stopGame?.();
    stopGame = null;
    unmountLogin?.();
    unmountLogin = null;
    try {
      stopGame = launchGame(app, nickname, skin);
    } catch (error) {
      console.error("[Bootstrap] Failed to start the game", error);
      showStartupError(app, t("error.title"), t("session.startFailed"));
    }
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
  const cleanups: Array<() => void> = [];
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("beforeunload", stop);
    for (let i = cleanups.length - 1; i >= 0; i--) {
      try {
        cleanups[i]();
      } catch (error) {
        console.warn("[Bootstrap] Game cleanup step failed", error);
      }
    }
  };

  try {
    const canvasContainer = document.createElement("div");
    canvasContainer.id = "game-canvas-container";
    canvasContainer.classList.add("game-canvas-container");
    app.appendChild(canvasContainer);
    cleanups.push(() => canvasContainer.remove());

    const hudContainer = document.createElement("div");
    hudContainer.className = "hud-container";
    app.appendChild(hudContainer);
    cleanups.push(() => hudContainer.remove());

    const game = new Game(canvasContainer);
    cleanups.push(() => game.destroy());

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("debug") === "true") {
      game.toggleDebug();
    }

    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;

    const detachGameUi = attachGameUiBridge();
    cleanups.push(detachGameUi);
    const unmountHud = mountGameHud(hudContainer, isMobile);
    cleanups.push(unmountHud);

    const steering = new SteeringIndicator(hudContainer);
    cleanups.push(() => steering.destroy());
    const minimap = new Minimap(hudContainer);
    cleanups.push(() => minimap.destroy());

    const gameOverContainer = document.createElement("div");
    gameOverContainer.className = "game-over-root";
    hudContainer.appendChild(gameOverContainer);
    const unmountGameOver = mountGameOverScreen(gameOverContainer, game.networkManager, () =>
      game.getMyId(),
    );
    cleanups.push(unmountGameOver);
    const mobile = new MobileControls(hudContainer, game.getInputManager());
    cleanups.push(() => mobile.destroy());

    const settingsContainer = document.createElement("div");
    app.appendChild(settingsContainer);
    cleanups.push(() => settingsContainer.remove());
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
    cleanups.push(unmountSettings);

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

    game.start(nickname, skin);
  } catch (error) {
    stop();
    throw error;
  }

  window.addEventListener("beforeunload", stop);
  return stop;
}
