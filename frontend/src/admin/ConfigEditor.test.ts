// @vitest-environment jsdom
// ROLE: Regression tests for admin config save/error classification.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigEditor } from "./ConfigEditor";

const CONFIG = {
  world: { width: 100, height: 100, target_food_count: 250 },
  simulation: { tick_rate: 30 },
  snake: { start_length: 5 },
  visual: { min_fog_radius: 100 },
  food: { base_radius: 1, radius_value_scale: 1, types: [] },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConfigEditor.save", () => {
  it("returns a structured error for validation failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(CONFIG), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "food.types must not be empty" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("food.base_radius", "2");

    const result = await editor.save();

    expect(result).toEqual({ ok: false, message: "food.types must not be empty" });
  });

  it("includes the field path for Pydantic validation errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(CONFIG), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: [
              {
                loc: ["body", "world", "target_food_cout"],
                msg: "Extra inputs are not permitted",
              },
            ],
          }),
          {
            status: 422,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("world.target_food_count", "300");

    const result = await editor.save();

    expect(result).toEqual({
      ok: false,
      message: "world.target_food_cout: Extra inputs are not permitted",
    });
  });
});
