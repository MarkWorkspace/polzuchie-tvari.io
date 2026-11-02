// @vitest-environment jsdom
// ROLE: Regression tests for the blocking error overlay accessibility and reload action.
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../lib/i18n";
import { GameErrorOverlay } from "./GameErrorOverlay";

afterEach(cleanup);

describe("GameErrorOverlay", () => {
  it("is a labelled alert dialog that focuses and traps the reload action", () => {
    render(
      <GameErrorOverlay
        title="Rendering error"
        message="The renderer stopped responding."
        onReload={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("alertdialog", { name: "Rendering error" });
    expect(dialog).toHaveAttribute("aria-modal", "true");

    const reload = screen.getByRole("button", { name: t("session.reload") });
    expect(reload).toHaveFocus();

    fireEvent.keyDown(reload, { key: "Tab" });
    expect(reload).toHaveFocus();
  });

  it("calls onReload", () => {
    const onReload = vi.fn();
    render(<GameErrorOverlay title="Error" message="Message" onReload={onReload} />);

    fireEvent.click(screen.getByRole("button", { name: t("session.reload") }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
