// ROLE: Lazy spectator UI bootstrap. Not renderer or network logic.
import { SettingsPanel } from "../ui/SettingsPanel";
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

  const spectator = new SpectatorApp(canvasContainer);
  const settings = new SettingsPanel(hudContainer, null, {
    onDebugToggle: () => {},
    onAdminClick: () => {
      window.location.search = "?admin=true";
    },
    onFpsToggle: (enabled: boolean) => {
      spectator.setStatsEnabled(enabled);
    },
  });

  window.addEventListener("beforeunload", () => {
    spectator.destroy();
    settings.destroy();
  });
}
