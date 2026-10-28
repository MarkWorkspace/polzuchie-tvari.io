// ROLE: Application entry point and route selection. Does not contain game logic.
import "./styles/main.css";
import "./styles/login.css";
import "./styles/hud_score.css";
import "./styles/hud.css";
import "./styles/admin.css";
import "./styles/minimap.css";
import "./styles/settings.css";
import "./styles/spectator.css";

import { resolveSpectatorMode } from "./game/spectatorMode";

document.addEventListener("DOMContentLoaded", () => {
  // Prevent pinch-to-zoom gestures on iOS devices
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("gesturechange", (event) => event.preventDefault());
  document.addEventListener("gestureend", (event) => event.preventDefault());

  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const urlParams = new URLSearchParams(window.location.search);
  const isAdmin =
    urlParams.has("admin") ||
    window.location.pathname.startsWith("/admin") ||
    window.location.hash.startsWith("#admin") ||
    window.location.hash.startsWith("#/admin");
  const spectatorMode = resolveSpectatorMode(urlParams);

  if (spectatorMode.enabled) {
    showBootScreen(app, "Loading spectator");
    void import("./game/spectatorBootstrap")
      .then(({ mountSpectator }) => mountSpectator(app, { debug: spectatorMode.debug }))
      .catch(() => showBootScreen(app, "Could not load the spectator. Refresh the page."));
  } else if (isAdmin) {
    showBootScreen(app, "Loading admin");
    void import("./admin/react/mountAdmin")
      .then(({ mountAdmin }) => mountAdmin(app))
      .catch(() => showBootScreen(app, "Could not load the admin panel. Refresh the page."));
  } else {
    showBootScreen(app, "Loading");
    void import("./game/bootstrap")
      .then(({ showLoginScreen }) => showLoginScreen(app))
      .catch(() => showBootScreen(app, "Could not load the game. Refresh the page."));
  }
});

function showBootScreen(app: HTMLDivElement, message: string): void {
  app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-spinner" aria-hidden="true"></div>
      <p>${message}</p>
    </div>
  `;
}
