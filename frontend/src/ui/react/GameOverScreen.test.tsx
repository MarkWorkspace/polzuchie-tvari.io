// @vitest-environment jsdom
// ROLE: Regression tests for the React death overlay and respawn action.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkManager } from "../../game/NetworkManager";
import { GameOverScreen } from "./GameOverScreen";

afterEach(cleanup);

describe("GameOverScreen", () => {
  it("shows only for the local victim and sends RESPAWN", () => {
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
    expect(screen.queryByText("ПОТРАЧЕНО")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("game-killfeed", {
          detail: {
            events: [{ victim: "me" }],
            players: { me: { score: 42, kills: 3 } },
          },
        }),
      );
    });
    expect(screen.getByText("ПОТРАЧЕНО")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ИГРАТЬ СНОВА" }));
    expect(send).toHaveBeenCalledWith("RESPAWN");
    expect(screen.queryByText("ПОТРАЧЕНО")).not.toBeInTheDocument();
  });
});
