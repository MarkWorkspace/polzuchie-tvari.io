// ROLE: Mount/unmount the "session moved to another tab" screen.
import { createRoot } from "react-dom/client";
import { SessionMovedScreen } from "./SessionMovedScreen";

export interface SessionMovedActions {
  onReload: () => void;
  onSpectate: () => void;
}

export function mountSessionMovedScreen(
  container: HTMLElement,
  actions: SessionMovedActions,
): () => void {
  container.replaceChildren();
  const root = createRoot(container);
  root.render(<SessionMovedScreen {...actions} />);
  return () => root.unmount();
}
