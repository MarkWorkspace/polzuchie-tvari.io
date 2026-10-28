// ROLE: Lazy spectator UI bootstrap. Splits the player-facing view from the admin debug view.
import { attachGameUiBridge } from "../ui/react/gameUiStore";
import { mountSettingsPanel } from "../ui/react/mountSettingsPanel";
import { mountSpectatorHud } from "../ui/react/mountSpectatorHud";
import { SpectatorApp } from "./SpectatorApp";

export interface SpectatorOptions {
  debug: boolean;
}

export function mountSpectator(app: HTMLDivElement, options: SpectatorOptions): void {
  app.replaceChildren();

  const canvasContainer = document.createElement("div");
  canvasContainer.id = "game-canvas-container";
  canvasContainer.classList.add("game-canvas-container");
  app.appendChild(canvasContainer);

  const hudContainer = document.createElement("div");
  hudContainer.className = "hud-container";
  app.appendChild(hudContainer);

  const detachGameUi = attachGameUiBridge();
  const spectator = new SpectatorApp(canvasContainer, { debug: options.debug });
  const unmountHud = options.debug ? () => {} : mountSpectatorHud(hudContainer);

  const settingsContainer = document.createElement("div");
  app.appendChild(settingsContainer);
  const unmountSettings = mountSettingsPanel(
    settingsContainer,
    null,
    {
      onAdminClick: () => {
        window.location.search = "?admin=true";
      },
      onFpsToggle: (enabled: boolean) => {
        spectator.setStatsEnabled(enabled);
      },
    },
    spectator,
  );

  window.addEventListener("beforeunload", () => {
    spectator.destroy();
    unmountHud();
    unmountSettings();
    detachGameUi();
  });
}
