// ROLE: Lazy spectator UI bootstrap. Not renderer or network logic.
import { attachGameUiBridge } from "../ui/react/gameUiStore";
import { mountSettingsPanel } from "../ui/react/mountSettingsPanel";
import { SpectatorApp } from "./SpectatorApp";

export function mountSpectator(app: HTMLDivElement): void {
  app.replaceChildren();

  const canvasContainer = document.createElement("div");
  canvasContainer.id = "game-canvas-container";
  canvasContainer.classList.add("game-canvas-container");
  app.appendChild(canvasContainer);

  const hudContainer = document.createElement("div");
  hudContainer.className = "hud-container";
  app.appendChild(hudContainer);

  const detachGameUi = attachGameUiBridge();
  const spectator = new SpectatorApp(canvasContainer);
  const settingsContainer = document.createElement("div");
  app.appendChild(settingsContainer);
  const unmountSettings = mountSettingsPanel(
    settingsContainer,
    null,
    {
      onDebugToggle: () => {},
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
    unmountSettings();
    detachGameUi();
  });
}
