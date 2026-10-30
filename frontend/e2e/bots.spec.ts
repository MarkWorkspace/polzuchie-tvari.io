// ROLE: E2E test for the live bot toggle through the admin config.
import { expect, test } from "@playwright/test";
import { loginAdmin, patchConfig, readConfig, readHealth } from "./adminApi";

test("admin enables and disables bots live", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await loginAdmin(request);
  const originalConfig = await readConfig(request);

  try {
    await patchConfig(request, {
      bots: { enabled: 1, count: 1, respawn_delay_seconds: 2 },
    });
    // Bot spawn position is random, so assert the authoritative server state
    // instead of relying on the bot appearing in the spectator leaderboard.
    await expect.poll(async () => (await readHealth(request)).bots, { timeout: 15_000 }).toBe(1);

    await page.goto("/?spectator=true");
    await expect(page.locator(".spectator-badge")).toContainText("Live");
  } finally {
    await patchConfig(request, originalConfig);
  }

  await expect.poll(async () => (await readHealth(request)).bots, { timeout: 15_000 }).toBe(0);
  expect(pageErrors).toEqual([]);
});
