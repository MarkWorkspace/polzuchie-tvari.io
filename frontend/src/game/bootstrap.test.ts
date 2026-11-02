// ROLE: Unit tests for the pre-login Worker/WebGL2 probe and lazy Game loader.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const gameModuleFactory = vi.hoisted(() => vi.fn(() => ({ Game: class FakeGame {} })));
vi.mock("./Game", gameModuleFactory);

type RuntimeSupportModule = typeof import("./bootstrap");

let checkRuntimeSupport: RuntimeSupportModule["checkRuntimeSupport"];
let loadGameModule: RuntimeSupportModule["loadGameModule"];

beforeAll(async () => {
  // The bootstrap graph reads window at module scope (mobile detection), but
  // the probe itself must work with an injected environment.
  vi.stubGlobal("window", { innerWidth: 1024 });
  ({ checkRuntimeSupport, loadGameModule } = await import("./bootstrap"));
});

describe("loadGameModule", () => {
  it("does not evaluate the Game module until the player starts", async () => {
    expect(gameModuleFactory).not.toHaveBeenCalled();

    const module = await loadGameModule();

    expect(gameModuleFactory).toHaveBeenCalledTimes(1);
    expect(typeof module.Game).toBe("function");
  });

  it("delegates to an injected loader", async () => {
    const fakeModule = { Game: class FakeGame {} } as unknown as Awaited<
      ReturnType<RuntimeSupportModule["loadGameModule"]>
    >;
    const loader = vi.fn(async () => fakeModule);

    await expect(loadGameModule(loader)).resolves.toBe(fakeModule);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("propagates chunk-loading failures", async () => {
    const failure = new Error("chunk failed");

    await expect(
      loadGameModule(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
  });
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
