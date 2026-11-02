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

  it("announces respawn before sending RESPAWN so held input is released", () => {
    const sequence: string[] = [];
    const send = vi.fn(() => sequence.push("send"));
    const onRespawn = () => sequence.push("respawn");
    window.addEventListener("game-respawn", onRespawn);

    try {
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
              events: [{ victim: "me" }],
              players: { me: { score: 1, kills: 0, body_len: 9 } },
            },
          }),
        );
      });

      fireEvent.click(screen.getByRole("button", { name: t("gameOver.playAgain") }));
      expect(sequence).toEqual(["respawn", "send"]);
    } finally {
      window.removeEventListener("game-respawn", onRespawn);
    }
  });

  it("is a labelled modal that focuses respawn and restores focus after respawn", () => {
    const sentinel = document.createElement("button");
    sentinel.textContent = "sentinel";
    document.body.appendChild(sentinel);
    sentinel.focus();

    try {
      render(
        <GameOverScreen
          networkManager={{ send: vi.fn() } as unknown as NetworkManager}
          getMyId={() => "me"}
        />,
      );

      act(() => {
        window.dispatchEvent(
          new CustomEvent("game-killfeed", {
            detail: {
              events: [{ victim: "me" }],
              players: { me: { score: 5, kills: 0, body_len: 4 } },
            },
          }),
        );
      });

      const dialog = screen.getByRole("dialog", { name: t("gameOver.title") });
      expect(dialog).toHaveAttribute("aria-modal", "true");

      const respawn = screen.getByRole("button", { name: t("gameOver.playAgain") });
      expect(respawn).toHaveFocus();

      fireEvent.keyDown(respawn, { key: "Tab" });
      expect(respawn).toHaveFocus();

      fireEvent.click(respawn);
      expect(screen.queryByText(t("gameOver.title"))).not.toBeInTheDocument();
      expect(sentinel).toHaveFocus();
    } finally {
      sentinel.remove();
    }
  });

  it("shows the preserved final length of the local player's death", () => {
    // FrameComputer fills body_len from Player.final_length for dead players,
    // so the overlay must render that value instead of a zero placeholder.
    render(
      <GameOverScreen
        networkManager={{ send: vi.fn() } as unknown as NetworkManager}
        getMyId={() => "me"}
      />,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("game-killfeed", {
          detail: {
            events: [{ victim: "me" }],
            players: { me: { score: 0, kills: 0, body_len: 12 } },
          },
        }),
      );
    });

    expect(screen.getByText("12")).toHaveClass("stat-length");
  });
});
