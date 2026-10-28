// ROLE: E2E smoke test for spectator mode: live world, no player identity, settings.
import { expect, test } from "@playwright/test";

test("spectates the live world without a player identity", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?spectator=true");

  await expect(page.getByLabel("Your nickname")).toHaveCount(0);
  await expect(page.locator("#game-canvas-container")).toBeVisible();
  await expect(page.getByText("SPECTATOR MODE")).toBeVisible();
  await expect(page.getByText(/Players: \d+/)).toBeVisible();
  await expect(page.getByText(/Ping: \d+ ms/)).toBeVisible();

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const drawer = page.locator(".settings-drawer");
  await expect(drawer).toHaveClass(/open/);
  await expect(page.getByRole("combobox", { name: "Quality" })).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(drawer).not.toHaveClass(/open/);

  // Spectator identity must never be written as a player client id.
  expect(await page.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();
  expect(pageErrors).toEqual([]);
});
