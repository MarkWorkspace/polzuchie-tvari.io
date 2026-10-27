// @vitest-environment jsdom
// ROLE: Regression tests for the React settings drawer.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputManager } from "../../game/InputManager";
import { SettingsPanel } from "./SettingsPanel";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("SettingsPanel", () => {
  it("opens the drawer and toggles FPS", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const onFpsToggle = vi.fn();
    const inputManager = {
      getControlMode: () => "mouse",
      setControlMode: vi.fn(),
    } as unknown as InputManager;

    render(
      <SettingsPanel
        inputManager={inputManager}
        callbacks={{ onDebugToggle: vi.fn(), onAdminClick: vi.fn(), onFpsToggle }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Show FPS/ }));

    expect(onFpsToggle).toHaveBeenCalledWith(true);
    expect(localStorage.getItem("snake-show-fps")).toBe("true");
  });
});
