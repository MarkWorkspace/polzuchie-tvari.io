// @vitest-environment jsdom
// ROLE: Regression tests for the React death overlay, run summary and respawn action.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NetworkManager } from "../../game/NetworkManager";
import { t } from "../../lib/i18n";
import { GameOverScreen } from "./GameOverScreen";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("GameOverScreen", () => {
  it("shows the run summary and a new record only for the local victim", () => {
    const send = vi.fn();
    render(
      <GameOverScreen
        networkManager={{ send } as unknown as NetworkManager}
        getMyId={() => "me"}
      />,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("game-killfeed", {
          detail: {
            events: [{ victim: "someone-else" }],
            players: { "someone-else": { score: 1 } },
          },
        }),
      );
    });
    expect(screen.queryByText(t("gameOver.title"))).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("game-killfeed", {
          detail: {
            events: [{ victim: "me" }],
            players: { me: { score: 42, kills: 3, body_len: 17 } },
          },
        }),
      );
    });
    expect(screen.getByText(t("gameOver.title"))).toBeInTheDocument();
    expect(screen.getByText("42")).toHaveClass("stat-score");
    expect(screen.getByText("17")).toHaveClass("stat-length");
    expect(screen.getByText("3")).toHaveClass("stat-kills");
    expect(screen.getByText(t("gameOver.newRecord"))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: t("gameOver.playAgain") }));
    expect(send).toHaveBeenCalledWith("RESPAWN");
    expect(screen.queryByText(t("gameOver.title"))).not.toBeInTheDocument();
  });
});
