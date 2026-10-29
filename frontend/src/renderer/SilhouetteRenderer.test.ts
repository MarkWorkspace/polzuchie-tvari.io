// ROLE: Unit tests for silhouette target sizing.
import { describe, expect, it } from "vitest";
import { silhouetteSize } from "./SilhouetteRenderer";

describe("silhouetteSize", () => {
  it("downscales the drawing buffer by the requested factor", () => {
    expect(silhouetteSize(1440, 900, 1, 2)).toEqual({ width: 720, height: 450 });
    expect(silhouetteSize(1440, 900, 1, 4)).toEqual({ width: 360, height: 225 });
  });

  it("accounts for the device pixel ratio", () => {
    expect(silhouetteSize(800, 600, 2, 2)).toEqual({ width: 800, height: 600 });
  });

  it("never produces an empty target", () => {
    const size = silhouetteSize(1, 1, 0.1, 4);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it("falls back to sane values when the renderer reports nonsense", () => {
    expect(silhouetteSize(400, 400, Number.NaN, 2)).toEqual(silhouetteSize(400, 400, 1, 2));
    expect(silhouetteSize(400, 400, 0, 2)).toEqual(silhouetteSize(400, 400, 1, 2));
    expect(silhouetteSize(400, 400, 1, 0)).toEqual({ width: 400, height: 400 });
  });

  it("rounds to whole texels", () => {
    const size = silhouetteSize(1441, 901, 1.5, 2);
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});
