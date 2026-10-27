// ROLE: Mount/unmount the React login screen.
import { createRoot } from "react-dom/client";
import { LoginScreen } from "./LoginScreen";

export function mountLoginScreen(
  container: HTMLElement,
  onPlay: (nickname: string, skin: string) => void,
): () => void {
  const root = createRoot(container);
  root.render(<LoginScreen onPlay={onPlay} />);
  return () => root.unmount();
}
