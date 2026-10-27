// ROLE: Mount/unmount the React settings drawer.
import { createRoot } from "react-dom/client";
import type { InputManager } from "../../game/InputManager";
import { type SettingsCallbacks, SettingsPanel } from "./SettingsPanel";

export function mountSettingsPanel(
  container: HTMLElement,
  inputManager: InputManager | null,
  callbacks: SettingsCallbacks,
): () => void {
  const root = createRoot(container);
  root.render(<SettingsPanel inputManager={inputManager} callbacks={callbacks} />);
  return () => root.unmount();
}
