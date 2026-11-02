// ROLE: Regression tests for FRAME_UNAVAILABLE replies and requestId propagation in the worker.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const postMessage = vi.fn();
const workerSelf: {
  onmessage: ((event: { data: any }) => void) | null;
  postMessage: any;
} = { onmessage: null, postMessage };

let workerModule: typeof import("./worker");

beforeAll(async () => {
  vi.stubGlobal("self", workerSelf);
  workerModule = await import("./worker");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("worker FRAME_UNAVAILABLE", () => {
  it("carries the request id", () => {
    expect(workerModule.buildFrameUnavailable(7)).toEqual({
      type: "FRAME_UNAVAILABLE",
      requestId: 7,
    });
  });

  it("omits requestId for a legacy request", () => {
    expect(workerModule.buildFrameUnavailable(undefined)).toEqual({ type: "FRAME_UNAVAILABLE" });
  });

  it("answers a frame request without interpolation with FRAME_UNAVAILABLE", () => {
    postMessage.mockClear();

    workerSelf.onmessage?.({
      data: {
        type: "REQUEST_FRAME",
        requestId: 42,
        dt: 0.016,
        myId: "me",
        localInput: { turn: 0 },
        gridSize: 20,
        isSpectator: false,
        showAllInMainCopy: false,
      },
    });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][0]).toEqual({
      type: "FRAME_UNAVAILABLE",
      requestId: 42,
    });
  });
});
