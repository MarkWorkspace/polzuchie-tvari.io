// ROLE: Mount the React admin app into a DOM container. Not game logic.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminApp } from "./AdminApp";

export function mountAdmin(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
