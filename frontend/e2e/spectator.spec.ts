// ROLE: E2E tests for the player spectator and the admin debug spectator.
import { expect, test } from "@playwright/test";

test("player spectator shows a clean HUD without player identity", async ({ page }) => {
  const pageErrors: string[] = [];
  const sessionRequests: string[] = [];
  const wsUrls: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/session")) {
      sessionRequests.push(request.url());
    }
  });
  page.on("websocket", (socket) => wsUrls.push(socket.url()));

  await page.goto("/?spectator=true");

  await expect(page.getByLabel("Your nickname")).toHaveCount(0);
  await expect(page.locator("#game-canvas-container")).toBeVisible();
  await expect(page.getByText(/Spectating/)).toBeVisible();
  await expect(page.locator(".spectator-badge")).toContainText("Live");
  await expect(page.locator(".leaderboard-panel")).toBeVisible();
  await expect(page.getByText("SPECTATOR MODE")).toHaveCount(0);
  await expect(page.getByText("GLOBAL DEBUG")).toHaveCount(0);

  // Spectators never create or reuse a player session.
  expect(sessionRequests).toEqual([]);
  expect(wsUrls.some((url) => url.includes("role=spectator"))).toBe(true);
  expect(wsUrls.some((url) => url.includes("client_id"))).toBe(false);

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const drawer = page.locator(".settings-drawer");
  await expect(drawer).toHaveClass(/open/);
  await expect(page.getByRole("combobox", { name: "Quality" })).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(drawer).not.toHaveClass(/open/);

  // Spectator identity must never be exposed as a player id.
  expect(await page.evaluate(() => document.body.dataset.playerId ?? null)).toBeNull();
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
  expect(await page.evaluate(() => document.body.dataset.playerId ?? null)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();

  expect(pageErrors).toEqual([]);
});

test("follows a selected player and returns to overview", async ({ page, context }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const playerPage = await context.newPage();
  playerPage.on("pageerror", (error) => pageErrors.push(error.message));

  await playerPage.goto("/");
  await playerPage.getByLabel("Your nickname").fill("Follow Target");
  await playerPage.getByRole("button", { name: "Play", exact: true }).click();
  await expect(playerPage.locator(".hud-guide.connected")).toBeVisible();

  await page.goto("/?spectator=true");
  const row = page.locator(".leaderboard-item--selectable").filter({ hasText: "Follow Target" });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator(".spectator-following")).toContainText("Following: Follow Target");

  await page.getByRole("button", { name: "Map overview" }).click();
  await expect(page.locator(".spectator-following")).toHaveCount(0);

  await row.click();
  await expect(page.locator(".spectator-following")).toContainText("Following: Follow Target");

  // Losing the followed player must clear the follow state automatically.
  await playerPage.close();
  await expect(page.locator(".spectator-following")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
