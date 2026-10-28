// ROLE: E2E test for the live bot toggle through the admin config.
import { expect, test } from "@playwright/test";
import { loginAdmin, patchConfig, readConfig } from "./adminApi";

test("admin enables and disables bots live", async ({ page, request }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await loginAdmin(request);
  const originalConfig = await readConfig(request);

  try {
    await patchConfig(request, {
      bots: { enabled: 1, count: 1, respawn_delay_seconds: 2 },
    });

    await page.goto("/?spectator=true");
    const botRow = page.locator(".leaderboard-item--selectable").filter({ hasText: "Bot 1" });
    await expect(botRow).toBeVisible();
  } finally {
    await patchConfig(request, originalConfig);
  }

  await expect(
    page.locator(".leaderboard-item--selectable").filter({ hasText: "Bot 1" }),
  ).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
