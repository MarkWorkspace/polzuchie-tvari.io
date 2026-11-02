// ROLE: E2E smoke tests for admin config save/restart and reconnect identity. Not product code.
import { expect, test } from "@playwright/test";
import { loginAdmin, patchConfig, readConfig, readHealth, restartGame } from "./adminApi";

interface AdminConfig {
  world: { target_food_count: number; [key: string]: unknown };
  bots?: { enabled?: number; [key: string]: unknown };
  [key: string]: unknown;
}

test("admin saves config and restarts the world", async ({ request }) => {
  await loginAdmin(request);
  const originalConfig = (await readConfig(request)) as AdminConfig;

  try {
    await patchConfig(request, { world: { target_food_count: 123 } });
    await expect
      .poll(async () => ((await readConfig(request)) as AdminConfig).world.target_food_count)
      .toBe(123);

    await restartGame(request);
    // Restart clears players, bots and spectators; the response returns after
    // reset_state(), but poll so a stray reconnect cannot be reported late.
    await expect
      .poll(async () => {
        const health = await readHealth(request);
        return { players: health.players, bots: health.bots, spectators: health.spectators };
      })
      .toEqual({ players: 0, bots: 0, spectators: 0 });
  } finally {
    // Always restore the seed config. Force bots off so a failed assertion
    // cannot leave the shared E2E backend spawning bots for later specs.
    await patchConfig(request, {
      ...originalConfig,
      bots: { ...(originalConfig.bots ?? {}), enabled: 0 },
    });
  }

  await expect
    .poll(async () => ((await readConfig(request)) as AdminConfig).world.target_food_count)
    .toBe(originalConfig.world.target_food_count);
});

test("player identity survives a page reload", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByLabel("Your nickname").fill("Reload Snake");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".hud-guide.connected")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.playerId ?? null))
    .not.toBeNull();
  const firstPlayerId = await page.evaluate(() => document.body.dataset.playerId ?? null);
  expect(firstPlayerId).not.toBeNull();

  await page.reload();
  await page.getByLabel("Your nickname").fill("Reload Snake");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator(".hud-guide.connected")).toBeVisible();

  // The reloaded page reuses the server session cookie, not browser storage.
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.playerId ?? null))
    .toBe(firstPlayerId);
  expect(await page.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();
  expect(pageErrors).toEqual([]);
});
