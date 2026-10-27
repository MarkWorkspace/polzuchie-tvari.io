// ROLE: Mount/unmount the React game-over overlay.
import { createRoot } from "react-dom/client";
import type { NetworkManager } from "../../game/NetworkManager";
import { GameOverScreen } from "./GameOverScreen";

export function mountGameOverScreen(
  container: HTMLElement,
  networkManager: NetworkManager,
  getMyId: () => string,
): () => void {
  const root = createRoot(container);
  root.render(<GameOverScreen networkManager={networkManager} getMyId={getMyId} />);
  return () => root.unmount();
}
