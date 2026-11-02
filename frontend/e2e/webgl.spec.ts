// ROLE: E2E regression for the WebGL context-loss overlay (pause + reload prompt, no in-place rebuild).
import { expect, test } from "@playwright/test";

test("shows a reload overlay when the WebGL context is lost", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByLabel("Your nickname").fill("E2E Context Loss");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".hud-guide.connected")).toBeVisible();

  // Stats.js also nests its own canvases inside the container; take the renderer's direct child.
  const canvas = page.locator("#game-canvas-container > canvas");
  await expect(canvas).toHaveCount(1);

  // Do not false-pass on software renderers without the extension: report a skip instead.
  const support = await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    if (!gl) return "no-webgl2";
    return gl.getExtension("WEBGL_lose_context") ? "supported" : "no-extension";
  });
  test.skip(support !== "supported", `WEBGL_lose_context is unavailable (${support})`);

  await canvas.evaluate((element) => {
    const gl = (element as HTMLCanvasElement).getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });

  const overlay = page.locator(".game-error-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("WebGL context lost");
  await expect(page.locator(".game-error-reload")).toBeVisible();
  expect(pageErrors).toEqual([]);
});
