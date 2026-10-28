// @vitest-environment jsdom
// ROLE: Regression tests for the React settings drawer.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InputManager } from "../../game/InputManager";
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
