// ROLE: E2E tests for the player spectator and the admin debug spectator.
import { expect, test } from "@playwright/test";

test("player spectator shows a clean HUD without player identity", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?spectator=true");

  await expect(page.getByLabel("Your nickname")).toHaveCount(0);
  await expect(page.locator("#game-canvas-container")).toBeVisible();
  await expect(page.getByText(/Spectating/)).toBeVisible();
  await expect(page.locator(".spectator-badge")).toContainText("Live");
  await expect(page.locator(".leaderboard-panel")).toBeVisible();
  await expect(page.getByText("SPECTATOR MODE")).toHaveCount(0);
  await expect(page.getByText("GLOBAL DEBUG")).toHaveCount(0);

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

test("debug spectator exposes the admin panels only", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?spectator=debug");

  await expect(page.getByText("SPECTATOR MODE")).toBeVisible();
  await expect(page.getByText("GLOBAL DEBUG")).toBeVisible();
  await expect(page.getByText("Debug Snake:")).toBeVisible();
  await expect(page.getByText("Отображать всё в главной копии")).toBeVisible();
  await expect(page.locator(".spectator-badge")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();

  expect(pageErrors).toEqual([]);
});
