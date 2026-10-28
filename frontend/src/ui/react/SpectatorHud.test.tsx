// @vitest-environment jsdom
// ROLE: Regression tests for the player-facing spectator HUD.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachGameUiBridge } from "./gameUiStore";
import { SpectatorHud } from "./SpectatorHud";

let detach: (() => void) | null = null;

beforeEach(() => {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  vi.useFakeTimers();
  detach = attachGameUiBridge();
});

afterEach(() => {
  cleanup();
  detach?.();
  detach = null;
  vi.useRealTimers();
});

function dispatch(name: string, detail: unknown): void {
  act(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  });
}

describe("SpectatorHud", () => {
  it("shows live status and the top players", () => {
    render(<SpectatorHud />);

    expect(screen.getByText(/Spectating/)).toBeInTheDocument();
    expect(screen.getByText("Connecting to server...")).toBeInTheDocument();

    dispatch("game-status", { status: "connected", controlMode: "mouse" });
    dispatch("game-leaderboard", [
      { id: "a", nickname: "Alpha", score: 12, kills: 2, deaths: 0, isMe: false },
    ]);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Top 10/)).toBeInTheDocument();
  });
});
