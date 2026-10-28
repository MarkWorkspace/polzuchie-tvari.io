// ROLE: E2E test for a real server-side death (black hole) and respawn. Not UI unit coverage.
import { type APIRequestContext, expect, test } from "@playwright/test";

const BACKEND_URL = "http://127.0.0.1:8000";
const ADMIN_PASSWORD = "e2e-admin";

async function loginAdmin(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/admin/login`, {
    data: { password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

async function readConfig(request: APIRequestContext): Promise<unknown> {
  const response = await request.get(`${BACKEND_URL}/admin/config`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function patchConfig(request: APIRequestContext, patch: unknown): Promise<void> {
  const response = await request.patch(`${BACKEND_URL}/admin/config`, { data: patch });
  expect(response.ok()).toBe(true);
}

test("dies to a black hole and respawns", async ({ page, request }) => {
  test.setTimeout(60_000);

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await loginAdmin(request);
  const originalConfig = await readConfig(request);

  try {
    // A 20x20 map and a 50-unit kill radius make the black hole lethal on
    // every tick, so the death arrives through the real server path.
    await patchConfig(request, {
      world: {
        width: 20,
        height: 20,
        black_holes_enabled: 1,
        black_holes_count: 1,
        black_holes_spawn_chance: 1,
        black_holes_pull_radius: 100,
        black_holes_pull_force: 0,
        black_holes_kill_radius: 50,
        black_holes_growth_time: 0.1,
      },
    });

    await page.goto("/");
    await page.getByLabel("Your nickname").fill("E2E Victim");
    await page.getByRole("button", { name: "Play", exact: true }).click();

    await expect(page.locator(".game-over-overlay")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".game-over-title")).toHaveText("ПОТРАЧЕНО");
  } finally {
    await patchConfig(request, originalConfig);
  }

  await page.getByRole("button", { name: "ИГРАТЬ СНОВА" }).click();
  await expect(page.locator(".game-over-overlay")).toHaveCount(0);
  await expect(page.locator(".hud-guide.connected")).toBeVisible();

  expect(pageErrors).toEqual([]);
});
