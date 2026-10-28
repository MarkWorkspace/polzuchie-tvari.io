// ROLE: Unit tests for the spectator leaderboard projection.
import { describe, expect, it } from "vitest";
import { buildSpectatorLeaderboard } from "./spectatorLeaderboard";

describe("buildSpectatorLeaderboard", () => {
  it("takes ids from the player map keys and sorts by score", () => {
    const entries = buildSpectatorLeaderboard({
      alpha: { nickname: "Alpha", score: 4.9, kills: 1, deaths: 2 },
      beta: { nickname: "Beta", score: 12, kills: 3, deaths: 0 },
      ghost: undefined,
    });

    expect(entries).toEqual([
      { id: "beta", nickname: "Beta", score: 12, kills: 3, deaths: 0, isMe: false },
      { id: "alpha", nickname: "Alpha", score: 4, kills: 1, deaths: 2, isMe: false },
    ]);
  });

  it("limits rows and fills missing fields", () => {
    const players = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [
        `player-${index}`,
        { nickname: `P${index}`, score: index },
      ]),
    );

    const entries = buildSpectatorLeaderboard(players, 10);

    expect(entries).toHaveLength(10);
    expect(entries[0]).toMatchObject({ id: "player-11", score: 11, kills: 0, deaths: 0 });
  });
});
