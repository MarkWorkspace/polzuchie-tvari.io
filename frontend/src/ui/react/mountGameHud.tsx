// ROLE: Mount/unmount the React in-game HUD inside the HUD grid container.
import { createRoot } from "react-dom/client";
import { GameHud } from "./GameHud";

export function mountGameHud(container: HTMLElement, isMobile: boolean): () => void {
  const host = document.createElement("div");
  host.className = "hud-root";
  container.appendChild(host);

  const root = createRoot(host);
  root.render(<GameHud isMobile={isMobile} />);

  return () => {
    root.unmount();
    host.remove();
  };
}
