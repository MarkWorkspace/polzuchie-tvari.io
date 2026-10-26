// ROLE: slice() must never expose a shared worker buffer to the main thread.
import { describe, expect, it } from "vitest";
import { GrowableFloat32Array, GrowableUint32Array } from "./GrowableArray";

describe("GrowableArray.slice", () => {
  it("returns an independent Float32 copy", () => {
    const source = new GrowableFloat32Array(4);
    source.push2(1, 2);
    const copy = source.slice();

    source.reset();
    source.push2(3, 4);

    expect(Array.from(copy)).toEqual([1, 2]);
  });

  it("returns an independent Uint32 copy", () => {
    const source = new GrowableUint32Array(4);
    source.push3(1, 2, 3);
    const copy = source.slice();

    source.reset();
    source.push3(9, 9, 9);

    expect(Array.from(copy)).toEqual([1, 2, 3]);
  });
});
