// ROLE: E2E smoke test for the admin login and dashboard.
import { expect, test } from "@playwright/test";

test("logs into the admin dashboard and out again", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?admin=true");
  await expect(page.getByRole("heading", { name: "Admin Portal" })).toBeVisible();

  await page.getByLabel("Admin password").fill("e2e-admin");
  await page.getByRole("button", { name: "Authorize" }).click();

  await expect(page.locator(".admin-app")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await expect(page.locator(".admin-health")).toContainText("online");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Admin Portal" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
