// @vitest-environment jsdom
// ROLE: Regression tests for the React settings drawer.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InputManager } from "../../game/InputManager";
import type { RenderQualityControl } from "../../renderer/RenderQuality";
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
      setUiOpen: vi.fn(),
    } as unknown as InputManager;

    render(
      <SettingsPanel
        inputManager={inputManager}
        callbacks={{ onAdminClick: vi.fn(), onFpsToggle }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /Show FPS/ }));

    expect(onFpsToggle).toHaveBeenCalledWith(true);
    expect(localStorage.getItem("snake-show-fps")).toBe("true");
  });

  it("hides the trigger while the drawer is open so it cannot cover the close button", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    render(
      <SettingsPanel
        inputManager={null}
        callbacks={{ onAdminClick: vi.fn(), onFpsToggle: vi.fn() }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(trigger);

    expect(trigger).toHaveClass("hidden");
    expect(trigger).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(document.querySelector(".settings-drawer")).not.toHaveClass("open");
  });

  it("focuses the close button, closes on Escape and restores trigger focus", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    render(
      <SettingsPanel
        inputManager={null}
        callbacks={{ onAdminClick: vi.fn(), onFpsToggle: vi.fn() }}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".settings-drawer")).not.toHaveClass("open");
    expect(trigger).toHaveFocus();
  });

  it("marks input as UI-owned while the drawer is open", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const setUiOpen = vi.fn();
    const inputManager = {
      getControlMode: () => "mouse",
      setControlMode: vi.fn(),
      setUiOpen,
    } as unknown as InputManager;

    const { unmount } = render(
      <SettingsPanel
        inputManager={inputManager}
        callbacks={{ onAdminClick: vi.fn(), onFpsToggle: vi.fn() }}
      />,
    );

    expect(setUiOpen).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(setUiOpen).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(setUiOpen).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    unmount();
    expect(setUiOpen).toHaveBeenLastCalledWith(false);
  });

  it("lets Escape close the drawer while a real InputManager is listening", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const inputManager = new InputManager();

    try {
      render(
        <SettingsPanel
          inputManager={inputManager}
          callbacks={{ onAdminClick: vi.fn(), onFpsToggle: vi.fn() }}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
      expect(inputManager.isUiOpen()).toBe(true);

      fireEvent.keyDown(screen.getByRole("button", { name: "Close menu" }), {
        key: "Escape",
        code: "Escape",
      });
      expect(document.querySelector(".settings-drawer")).not.toHaveClass("open");
      expect(inputManager.isUiOpen()).toBe(false);
    } finally {
      inputManager.destroy();
    }
  });

  it("changes graphics quality through the control", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const setQuality = vi.fn();
    const qualityControl: RenderQualityControl = {
      getQuality: () => "auto",
      setQuality,
    };

    render(
      <SettingsPanel
        inputManager={null}
        callbacks={{ onAdminClick: vi.fn(), onFpsToggle: vi.fn() }}
        qualityControl={qualityControl}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const select = screen.getByRole("combobox", { name: "Quality" });
    expect(select).toHaveValue("auto");

    fireEvent.change(select, { target: { value: "high" } });
    expect(setQuality).toHaveBeenCalledWith("high");
    expect(select).toHaveValue("high");
  });
});
