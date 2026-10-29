// ROLE: Mount/unmount the React login screen.
import { createRoot } from "react-dom/client";
import { LoginScreen, type LoginScreenActions } from "./LoginScreen";

export function mountLoginScreen(container: HTMLElement, actions: LoginScreenActions): () => void {
  const root = createRoot(container);
  root.render(<LoginScreen {...actions} />);
  return () => root.unmount();
}
