// @vitest-environment jsdom
// ROLE: Regression tests for admin config save error kinds and image-path validation.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigEditor } from "./ConfigEditor";

const CONFIG = {
  world: { width: 100, height: 100, target_food_count: 250 },
  simulation: { tick_rate: 30 },
  snake: { start_length: 5 },
  visual: { min_fog_radius: 100 },
  food: { base_radius: 1, radius_value_scale: 1, types: [] },
};

const CONFIG_WITH_FOOD = {
  ...CONFIG,
  food: {
    ...CONFIG.food,
    types: [{ value: 1, weight: 10, color: "#ffffff", image: "apple.svg" }],
  },
};

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConfigEditor.save", () => {
  it("returns a validation error for 400 responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockResolvedValueOnce(errorResponse(400, { detail: "food.types must not be empty" }));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("food.base_radius", "2");

    const result = await editor.save();

    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "food.types must not be empty",
      status: 400,
    });
  });

  it("includes the field path for Pydantic validation errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockResolvedValueOnce(
        errorResponse(422, {
          detail: [
            {
              loc: ["body", "world", "target_food_cout"],
              msg: "Extra inputs are not permitted",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("world.target_food_count", "300");

    const result = await editor.save();

    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "world.target_food_cout: Extra inputs are not permitted",
      status: 422,
    });
  });

  it("classifies 401 and 403 responses as auth errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockResolvedValueOnce(errorResponse(401, { detail: "Invalid admin session" }))
      .mockResolvedValueOnce(errorResponse(403, {}));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");

    editor.setDraft("food.base_radius", "2");
    expect(await editor.save()).toEqual({
      ok: false,
      kind: "auth",
      message: "Invalid admin session",
      status: 401,
    });

    editor.setDraft("food.base_radius", "3");
    expect(await editor.save()).toEqual({
      ok: false,
      kind: "auth",
      message: "Access denied: admin session is not authorized.",
      status: 403,
    });
  });

  it("classifies fetch exceptions as network errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("food.base_radius", "2");

    const result = await editor.save();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network");
      expect(result.message).toContain("Network error");
    }
  });

  it("classifies other failures as server errors with status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockResolvedValueOnce(errorResponse(500, { detail: "configuration write failed" }));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.setDraft("food.base_radius", "2");

    expect(await editor.save()).toEqual({
      ok: false,
      kind: "server",
      message: "configuration write failed",
      status: 500,
    });
  });

  it("rejects unsafe food image paths before sending PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse(CONFIG_WITH_FOOD));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.updateFoodType(0, "image", "../secret.svg");

    const result = await editor.save();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("validation");
      expect(result.message).toContain("Food type 1");
      expect(result.message).toContain("not allowed");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends safe relative food image paths in the PATCH body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(CONFIG))
      .mockResolvedValueOnce(okResponse(CONFIG));
    vi.stubGlobal("fetch", fetchMock);

    const editor = new ConfigEditor();
    expect(await editor.load()).toBe("OK");
    editor.addFoodType();
    editor.updateFoodType(0, "image", "food/apple.svg");

    expect(await editor.save()).toEqual({
      ok: true,
      message: "✓ Configuration successfully updated in real-time!",
    });

    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      food: { types: [{ image: "food/apple.svg" }] },
    });
  });
});
