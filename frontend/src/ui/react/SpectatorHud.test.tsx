// @vitest-environment jsdom
// ROLE: Regression tests for the player-facing spectator HUD.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function showLeaderboard(): void {
  dispatch("game-leaderboard", [
    { id: "a", nickname: "Alpha", score: 12, kills: 2, deaths: 0, isMe: false },
  ]);
  advance(250);
}

describe("SpectatorHud", () => {
  it("shows live status and the top players", () => {
    render(<SpectatorHud />);

    expect(screen.getByText(/Spectating/)).toBeInTheDocument();
    expect(screen.getByText("Connecting to server...")).toBeInTheDocument();

    dispatch("game-status", { status: "connected", controlMode: "mouse" });
    showLeaderboard();

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText(/Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/Top 10/)).toBeInTheDocument();
  });

  it("requests follow and overview through events", () => {
    const requests: Array<string | null> = [];
    const onFollow = (event: Event) => requests.push((event as CustomEvent).detail);
    window.addEventListener("spectator-follow", onFollow);

    render(<SpectatorHud />);
    showLeaderboard();

    fireEvent.click(screen.getByText("Alpha"));
    expect(screen.getByText("Following: Alpha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Map overview" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Map overview" }));
    expect(screen.queryByText("Following: Alpha")).not.toBeInTheDocument();
    expect(requests).toEqual(["a", null]);

    window.removeEventListener("spectator-follow", onFollow);
  });
});
