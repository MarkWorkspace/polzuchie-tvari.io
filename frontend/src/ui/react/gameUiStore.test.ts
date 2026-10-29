// @vitest-environment jsdom
// ROLE: Regression tests for the throttled game UI event bridge.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachGameUiBridge, gameUi, type LeaderboardEntry } from "./gameUiStore";

let detach: (() => void) | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  detach = attachGameUiBridge();
});

afterEach(() => {
  detach?.();
  detach = null;
  vi.useRealTimers();
});

function entry(id: string, score: number): LeaderboardEntry {
  return { id, nickname: id, score, kills: 0, deaths: 0, isMe: false };
}

function dispatch(name: string, detail: unknown): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

describe("gameUiStore", () => {
  it("coalesces leaderboard updates into one notification per throttle window", () => {
    const notifications: string[][] = [];
    const unsubscribe = gameUi.leaderboard.subscribe(() => {
      notifications.push(gameUi.leaderboard.getSnapshot().map((item) => item.id));
    });

    dispatch("game-leaderboard", [entry("a", 10)]);
    expect(gameUi.leaderboard.getSnapshot()).toEqual([]);

    vi.advanceTimersByTime(250);
    expect(notifications).toEqual([["a"]]);

    dispatch("game-leaderboard", [entry("b", 20)]);
    dispatch("game-leaderboard", [entry("c", 30)]);
    vi.advanceTimersByTime(249);
    expect(notifications).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(notifications).toEqual([["a"], ["c"]]);
    unsubscribe();
  });

  it("throttles score updates instead of rendering every event", () => {
    let notifications = 0;
    const unsubscribe = gameUi.score.subscribe(() => {
      notifications += 1;
    });

    for (let score = 1; score <= 20; score += 1) {
      dispatch("game-score-update", { score, delta: 1 });
    }
    expect(notifications).toBe(0);

    vi.advanceTimersByTime(100);
    expect(notifications).toBe(1);
    expect(gameUi.score.getSnapshot().score).toBe(20);
    unsubscribe();
  });

  it("keeps the last three score feed items and expires them", () => {
    for (const score of [10, 20, 30, 40]) {
      dispatch("game-score-update", { score, delta: 10 });
    }
    vi.advanceTimersByTime(100);

    expect(gameUi.score.getSnapshot().feed).toHaveLength(3);

    vi.advanceTimersByTime(1600);
    expect(gameUi.score.getSnapshot().feed).toEqual([]);
  });

  it("resolves kill feed nicknames, keeps five items and expires them", () => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      killer: `k${index}`,
      victim: `v${index}`,
    }));
    const players = Object.fromEntries(
      events.flatMap((event, index) => [
        [event.killer, { nickname: `Killer ${index}` }],
        [event.victim, { nickname: `Victim ${index}` }],
      ]),
    );

    dispatch("game-killfeed", { events, players });

    const items = gameUi.killFeed.getSnapshot();
    expect(items).toHaveLength(5);
    expect(items[0].killer).toBe("Killer 2");
    expect(items[4].victim).toBe("Victim 6");

    vi.advanceTimersByTime(5000);
    expect(gameUi.killFeed.getSnapshot()).toEqual([]);
  });

  it("marks environmental deaths with a null killer", () => {
    dispatch("game-killfeed", {
      events: [{ killer: "", victim: "v" }],
      players: { v: { nickname: "Victim" } },
    });

    expect(gameUi.killFeed.getSnapshot()[0]).toMatchObject({ killer: null, victim: "Victim" });
  });
});
