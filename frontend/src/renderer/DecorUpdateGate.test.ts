// ROLE: Tests for the decor rebuild throttle: fast view updates, slower translation.
import { describe, expect, it } from "vitest";
import {
  DECOR_REBUILD_INTERVAL_MS,
  DECOR_VIEW_REBUILD_INTERVAL_MS,
  DecorUpdateGate,
  type DecorViewState,
} from "./DecorUpdateGate";

const base: DecorViewState = {
  nowMs: 0,
  camX: 100,
  camY: -100,
  mapX: 200,
  mapY: 200,
  budget: 16000,
  cullRadius: 500,
  viewExtent: 100,
  viewKey: 1,
};

function primedGate(): DecorUpdateGate {
  const gate = new DecorUpdateGate();
  expect(gate.shouldRebuild(base)).toBe(true);
  gate.markBuilt(base);
  return gate;
}

describe("DecorUpdateGate", () => {
  it("rebuilds a camera rotation after the fast view interval", () => {
    const gate = primedGate();
    expect(
      gate.shouldRebuild({ ...base, nowMs: DECOR_VIEW_REBUILD_INTERVAL_MS - 1, viewKey: 2 }),
    ).toBe(false);
    expect(
      gate.shouldRebuild({ ...base, nowMs: DECOR_VIEW_REBUILD_INTERVAL_MS + 1, viewKey: 2 }),
    ).toBe(true);
  });

  it("keeps plain translation on the full rebuild interval", () => {
    const gate = primedGate();
    const moved = { ...base, camX: 140 };
    expect(gate.shouldRebuild({ ...moved, nowMs: DECOR_REBUILD_INTERVAL_MS - 1 })).toBe(false);
    expect(gate.shouldRebuild({ ...moved, nowMs: DECOR_REBUILD_INTERVAL_MS + 1 })).toBe(true);
  });

  it("rebuilds immediately when the budget or map changes", () => {
    const gate = primedGate();
    expect(gate.shouldRebuild({ ...base, nowMs: 1, budget: 8000 })).toBe(true);
    const next = primedGate();
    expect(next.shouldRebuild({ ...base, nowMs: 1, mapX: 300 })).toBe(true);
  });
});
