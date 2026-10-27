// ROLE: Playwright E2E configuration and local backend/frontend web servers.
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const isCi = Boolean(process.env.CI);
const backendDir = fileURLToPath(new URL("../backend", import.meta.url));

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
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
  ],
  webServer: [
    {
      command: "uv run --frozen uvicorn server:app --host 127.0.0.1 --port 8000",
      cwd: backendDir,
      url: "http://127.0.0.1:8000/health",
      timeout: 120_000,
      reuseExistingServer: !isCi,
      env: { ADMIN_PASSWORD: "e2e-admin", ENVIRONMENT: "development" },
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      timeout: 120_000,
      reuseExistingServer: !isCi,
    },
  ],
});
