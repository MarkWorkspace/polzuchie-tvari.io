// @vitest-environment jsdom
// ROLE: Regression tests for the session-moved dialog accessibility and focus trap.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../lib/i18n";
import { SessionMovedScreen } from "./SessionMovedScreen";

afterEach(cleanup);

describe("SessionMovedScreen", () => {
  it("is a labelled modal that traps focus between its actions", () => {
    render(<SessionMovedScreen onReload={vi.fn()} onSpectate={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: t("session.movedTitle") });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const spectate = screen.getByRole("button", { name: t("session.spectate") });
    const reload = screen.getByRole("button", { name: t("session.reload") });
    expect(spectate).toHaveFocus();

    fireEvent.keyDown(reload, { key: "Tab" });
    expect(spectate).toHaveFocus();

    fireEvent.keyDown(spectate, { key: "Tab", shiftKey: true });
    expect(reload).toHaveFocus();
  });

  it("forwards both actions", () => {
    const onReload = vi.fn();
    const onSpectate = vi.fn();
    render(<SessionMovedScreen onReload={onReload} onSpectate={onSpectate} />);

    fireEvent.click(screen.getByRole("button", { name: t("session.spectate") }));
    fireEvent.click(screen.getByRole("button", { name: t("session.reload") }));

    expect(onSpectate).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
