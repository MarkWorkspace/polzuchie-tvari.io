// ROLE: E2E regression for the WebGL context lifecycle: loss pauses the loop and shows the overlay, restore resumes in place (frame counter advances, same canvas, no reload).
import { expect, test } from "@playwright/test";

/** The extension handle is cached before the loss: getExtension() returns null on a lost context. */
type LoseContextWindow = Window & { __webglLoseContext?: WEBGL_lose_context };

test("pauses on WebGL context loss and resumes after restore", async ({ page }) => {
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
    const extension = gl.getExtension("WEBGL_lose_context");
    if (!extension) return "no-extension";
    (window as LoseContextWindow).__webglLoseContext = extension;
    return "supported";
  });
  test.skip(support !== "supported", `WEBGL_lose_context is unavailable (${support})`);

  // Survives a restore but not a reload, so it proves the page never reloaded.
  await page.evaluate(() => {
    (window as unknown as { __webglRestoreMarker?: number }).__webglRestoreMarker = 1;
  });

  // Wait for the loop to publish a frame number, then remember it as the baseline.
  await expect
    .poll(() => page.evaluate(() => Number(document.body.dataset.gameFrames ?? 0)))
    .toBeGreaterThan(0);
  const framesBefore = await page.evaluate(() => Number(document.body.dataset.gameFrames ?? 0));

  await page.evaluate(() => (window as LoseContextWindow).__webglLoseContext?.loseContext());

  const overlay = page.locator(".game-error-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("WebGL context lost");
  await expect(page.locator(".game-error-reload")).toBeVisible();

  // SceneManager rebuilds composer/contact-shadow targets and Game restarts the loop.
  await page.evaluate(() => (window as LoseContextWindow).__webglLoseContext?.restoreContext());

  // The frame counter must advance past the pre-loss value: the rAF loop really resumed.
  await expect
    .poll(() => page.evaluate(() => Number(document.body.dataset.gameFrames ?? 0)))
    .toBeGreaterThan(framesBefore);
  await expect
    .poll(() =>
      canvas.evaluate(
        (element) => (element as HTMLCanvasElement).getContext("webgl2")?.isContextLost() ?? true,
      ),
    )
    .toBe(false);

  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".hud-guide.connected")).toBeVisible();
  await expect(canvas).toHaveCount(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { __webglRestoreMarker?: number }).__webglRestoreMarker === 1,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
});
