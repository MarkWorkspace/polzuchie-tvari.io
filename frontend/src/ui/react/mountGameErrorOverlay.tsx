// ROLE: Mount/unmount the imperative React game error overlay and expose show/hide controls.
import { createRoot } from "react-dom/client";
import { GameErrorOverlay } from "./GameErrorOverlay";

export interface GameErrorOverlayOptions {
  title?: string;
  message?: string;
  onReload?: () => void;
}

export interface GameErrorOverlayHandle {
  show(message?: string): void;
  hide(): void;
  unmount(): void;
}

const DEFAULT_TITLE = "Rendering error";
const DEFAULT_MESSAGE = "The renderer stopped responding. Reload the page to continue playing.";

export function mountGameErrorOverlay(
  container: HTMLElement,
  options: GameErrorOverlayOptions = {},
): GameErrorOverlayHandle {
  const host = document.createElement("div");
  host.className = "game-error-root";
  container.appendChild(host);

  const root = createRoot(host);
  const title = options.title ?? DEFAULT_TITLE;
  const defaultMessage = options.message ?? DEFAULT_MESSAGE;
  const onReload = options.onReload ?? (() => window.location.reload());
  let active = true;

  const render = (message: string | null): void => {
    if (!active) return;
    root.render(
      message === null ? null : (
        <GameErrorOverlay title={title} message={message} onReload={onReload} />
      ),
    );
  };

  render(null);

  return {
    show(message = defaultMessage) {
      render(message);
    },
    hide() {
      render(null);
    },
    unmount() {
      if (!active) return;
      active = false;
      root.unmount();
      host.remove();
    },
  };
}
