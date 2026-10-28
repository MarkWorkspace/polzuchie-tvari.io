// ROLE: E2E smoke test for login, HUD, settings and the game-over overlay.
import { expect, test } from "@playwright/test";

test("plays the game, changes quality and respawns", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

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
    .poll(() => page.evaluate(() => localStorage.getItem("snake_client_id")))
    .not.toBeNull();

  await page.evaluate(() => {
    const clientId = localStorage.getItem("snake_client_id");
    if (!clientId) throw new Error("missing snake_client_id");
    window.dispatchEvent(
      new CustomEvent("game-killfeed", {
        detail: {
          events: [{ killer: "e2e-killer", victim: clientId }],
          players: {
            "e2e-killer": { nickname: "E2E Killer" },
            [clientId]: { nickname: "E2E Snake", score: 12, kills: 1 },
          },
        },
      }),
    );
  });

  await expect(page.locator(".game-over-overlay")).toBeVisible();
  await expect(page.locator(".game-over-title")).toHaveText("ПОТРАЧЕНО");
  await page.getByRole("button", { name: "ИГРАТЬ СНОВА" }).click();
  await expect(page.locator(".game-over-overlay")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
