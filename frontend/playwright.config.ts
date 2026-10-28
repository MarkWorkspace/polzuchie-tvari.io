// ROLE: Playwright E2E configuration and local backend/frontend web servers.

import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const backendDir = fileURLToPath(new URL("../backend", import.meta.url));

// Admin config edits during E2E must not mutate the tracked backend/config.json.
const e2eConfigPath = join(tmpdir(), `polzuchie-e2e-config-${process.pid}.json`);
copyFileSync(fileURLToPath(new URL("../backend/config.json", import.meta.url)), e2eConfigPath);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: isCi
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: [
    {
      command: "uv run --frozen uvicorn server:app --host 127.0.0.1 --port 8000",
      cwd: backendDir,
      url: "http://127.0.0.1:8000/health",
      timeout: 120_000,
      // Always start our own backend so the admin password matches the tests.
      reuseExistingServer: false,
      env: {
        ADMIN_PASSWORD: "e2e-admin",
        ENVIRONMENT: "development",
        CONFIG_PATH: e2eConfigPath,
      },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      timeout: 120_000,
      reuseExistingServer: !isCi,
    },
  ],
});
