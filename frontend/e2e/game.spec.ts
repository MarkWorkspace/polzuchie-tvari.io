// ROLE: E2E smoke test for login, HUD and settings.
import { expect, test } from "@playwright/test";

test("plays the game and changes quality", async ({ page }) => {
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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Polzuchie-tvari.io" })).toBeVisible();
  await page.getByLabel("Your nickname").fill("E2E Snake");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  await expect(page.locator(".score-panel")).toBeVisible();
  await expect(page.locator(".hud-guide.connected")).toBeVisible();
  await expect(page.locator(".ping-value")).not.toHaveText("offline");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const drawer = page.locator(".settings-drawer");
  await expect(drawer).toHaveClass(/open/);

  const quality = page.getByRole("combobox", { name: "Quality" });
  await expect(quality).toHaveValue(/^(auto|high|medium|low)$/);
  await quality.selectOption("low");
  await expect(quality).toHaveValue("low");
  // Re-enable SSAO/bloom and the normal pass, then go back to the cheap preset.
  await quality.selectOption("high");
  await expect(quality).toHaveValue("high");
  await quality.selectOption("low");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("snake-quality"))).toBe("low");

  const adminLink = page.locator(".drawer-admin-link");
  await adminLink.scrollIntoViewIfNeeded();
  await expect(adminLink).toBeInViewport();

  await page.getByRole("button", { name: "Close menu" }).click();
  await expect(drawer).not.toHaveClass(/open/);

  await expect
    .poll(() => page.evaluate(() => document.body.dataset.playerId ?? null))
    .not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();
  // Player identity comes from POST /session + cookie, not from the WS URL.
  expect(sessionRequests).toHaveLength(1);
  expect(wsUrls.some((url) => url.includes("role=player"))).toBe(true);
  expect(wsUrls.some((url) => url.includes("client_id"))).toBe(false);

  expect(pageErrors).toEqual([]);
});
