// ROLE: Unit tests for the pre-login Worker/WebGL2 feature probe.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type RuntimeSupportModule = typeof import("./bootstrap");

let checkRuntimeSupport: RuntimeSupportModule["checkRuntimeSupport"];

beforeAll(async () => {
  // The bootstrap graph reads window at module scope (mobile detection), but
  // the probe itself must work with an injected environment.
  vi.stubGlobal("window", { innerWidth: 1024 });
  ({ checkRuntimeSupport } = await import("./bootstrap"));
});

describe("checkRuntimeSupport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a runtime without Web Workers before touching WebGL", () => {
    const getWebGL2Context = vi.fn(() => ({}));

    expect(checkRuntimeSupport({ hasWorker: false, getWebGL2Context })).toEqual({
      ok: false,
      reason: "worker",
    });
    expect(getWebGL2Context).not.toHaveBeenCalled();
  });

  it("accepts a runtime with a Worker and a WebGL2 context", () => {
    expect(checkRuntimeSupport({ hasWorker: true, getWebGL2Context: () => ({}) })).toEqual({
      ok: true,
    });
  });

  it("rejects a browser without a WebGL2 context", () => {
    expect(checkRuntimeSupport({ hasWorker: true, getWebGL2Context: () => null })).toEqual({
      ok: false,
      reason: "webgl2",
    });
  });

  it("treats a throwing getContext as missing WebGL2", () => {
    const getWebGL2Context = () => {
      throw new Error("context creation failed");
    };

    expect(checkRuntimeSupport({ hasWorker: true, getWebGL2Context })).toEqual({
      ok: false,
      reason: "webgl2",
    });
  });

  it("creates a canvas and requests webgl2 by default", () => {
    const getContext = vi.fn(() => ({}));
    const createElement = vi.fn(() => ({ getContext }));
    vi.stubGlobal("document", { createElement });

    expect(checkRuntimeSupport({ hasWorker: true })).toEqual({ ok: true });
    expect(createElement).toHaveBeenCalledWith("canvas");
    expect(getContext).toHaveBeenCalledWith("webgl2");
  });
});
