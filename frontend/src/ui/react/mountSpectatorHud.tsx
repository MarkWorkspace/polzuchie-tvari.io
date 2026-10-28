// ROLE: Mount/unmount the React spectator HUD inside the HUD grid container.
import { createRoot } from "react-dom/client";
import { SpectatorHud } from "./SpectatorHud";

export function mountSpectatorHud(container: HTMLElement): () => void {
  const host = document.createElement("div");
  host.className = "hud-root";
  container.appendChild(host);

  const root = createRoot(host);
  root.render(<SpectatorHud />);

  return () => {
    root.unmount();
    host.remove();
  };
}
