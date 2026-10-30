// ROLE: E2E test for cross-tab player session ownership and takeover. Not unit coverage.
import { expect, test } from "@playwright/test";

test("moves the player session to a second tab", async ({ context }) => {
  test.setTimeout(60_000);
  const first = await context.newPage();
  const second = await context.newPage();
  const pageErrors: string[] = [];
  first.on("pageerror", (error) => pageErrors.push(`first: ${error.message}`));
  second.on("pageerror", (error) => pageErrors.push(`second: ${error.message}`));

  await first.goto("/");
  await first.getByLabel("Your nickname").fill("First Snake");
  await first.getByRole("button", { name: "Play", exact: true }).click();
  await expect(first.locator(".hud-guide.connected")).toBeVisible();
  await expect
    .poll(() => first.evaluate(() => document.body.dataset.playerId ?? null))
    .not.toBeNull();
  const firstId = await first.evaluate(() => document.body.dataset.playerId ?? null);

  await second.goto("/");
  await second.getByLabel("Your nickname").fill("Second Snake");
  await second.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    second.getByRole("heading", { name: "Game is already open in another tab" }),
  ).toBeVisible();

  await second.getByRole("button", { name: "Play here" }).click();

  await expect(second.locator(".hud-guide.connected")).toBeVisible();
  await expect(first.getByRole("heading", { name: "Session moved" })).toBeVisible();
  await expect(first.locator(".hud-guide.connected")).toHaveCount(0);

  // Takeover keeps the server-side player identity from the session cookie.
  await expect
    .poll(() => second.evaluate(() => document.body.dataset.playerId ?? null))
    .toBe(firstId);
  // The losing tab must stop exposing the player id.
  await expect.poll(() => first.evaluate(() => document.body.dataset.playerId ?? null)).toBeNull();
  expect(await first.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();
  expect(await second.evaluate(() => localStorage.getItem("snake_client_id"))).toBeNull();
  expect(pageErrors).toEqual([]);
});
