// @vitest-environment jsdom
// ROLE: Regression tests for the React in-game HUD widgets.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameHud } from "./GameHud";
import { attachGameUiBridge } from "./gameUiStore";

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

describe("GameHud", () => {
  it("shows connection status, score, score feed and ping", () => {
    render(<GameHud isMobile={false} />);

    expect(screen.getByText("Connecting to server...")).toBeInTheDocument();

    dispatch("game-status", { status: "connected", controlMode: "keyboard" });
    expect(screen.getByText(/A\/D\/Arrows/)).toBeInTheDocument();

    dispatch("game-score-update", { score: 42, delta: 12 });
    advance(100);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("+12")).toBeInTheDocument();

    dispatch("game-ping", 42);
    expect(screen.getByText("42 ms")).toBeInTheDocument();
    expect(screen.getByText("42 ms")).toHaveClass("ping-value");
  });

  it("renders leaderboard entries and highlights the local player", () => {
    render(<GameHud isMobile={false} />);

    dispatch("game-leaderboard", [
      { id: "a", nickname: "Alpha", score: 10, kills: 1, deaths: 2, isMe: false },
      { id: "me", nickname: "Me", score: 7, kills: 0, deaths: 1, isMe: true },
    ]);
    advance(250);

    const items = document.querySelectorAll(".leaderboard-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Alpha");
    expect(items[0].textContent).toContain("10");
    expect(items[1]).toHaveClass("self");
    expect(screen.getAllByTitle("Kills")[0]).toHaveTextContent("⚔️ 1");
  });

  it("resolves player names and environmental kill causes", () => {
    render(<GameHud isMobile={false} />);

    dispatch("game-killfeed", {
      events: [
        { killer: "k", victim: "v" },
        { killer: "", victim: "v" },
        { killer: "black_hole", victim: "v" },
        { killer: "tomb_k_3", victim: "v" },
      ],
      players: { k: { nickname: "Killer" }, v: { nickname: "Victim" } },
    });

    expect(screen.getByText("Killer")).toBeInTheDocument();
    expect(screen.getAllByText("Victim")).toHaveLength(4);
    expect(screen.getByText("Environment")).toBeInTheDocument();
    expect(screen.getByText("Black hole")).toBeInTheDocument();
    expect(screen.getByText("Tombstone")).toBeInTheDocument();
    // Raw server ids must never leak into the HUD.
    expect(screen.queryByText(/black_hole|tomb_/)).not.toBeInTheDocument();
  });

  it("limits the leaderboard to three rows and hides the header on mobile", () => {
    render(<GameHud isMobile />);

    dispatch("game-leaderboard", [
      { id: "a", nickname: "A", score: 50, kills: 0, deaths: 0, isMe: false },
      { id: "b", nickname: "B", score: 40, kills: 0, deaths: 0, isMe: false },
      { id: "c", nickname: "C", score: 30, kills: 0, deaths: 0, isMe: false },
      { id: "d", nickname: "D", score: 20, kills: 0, deaths: 0, isMe: false },
    ]);
    advance(250);

    expect(screen.getByText(/Top 3/)).toBeInTheDocument();
    expect(document.querySelectorAll(".leaderboard-item")).toHaveLength(3);
    expect(document.querySelector(".leaderboard-header")).toBeNull();
  });
});
