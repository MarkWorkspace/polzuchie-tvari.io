// ROLE: Playwright E2E configuration and local backend/frontend web servers.

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);
const backendDir = fileURLToPath(new URL("../backend", import.meta.url));

// Admin config edits during E2E must not mutate the tracked backend/config.json.
// Bots are disabled for deterministic specs and are covered by a dedicated test
// that enables them through the admin API.
const e2eConfigPath = join(tmpdir(), `polzuchie-e2e-config-${process.pid}.json`);
copyFileSync(fileURLToPath(new URL("../backend/config.json", import.meta.url)), e2eConfigPath);
const e2eConfig = JSON.parse(readFileSync(e2eConfigPath, "utf8")) as Record<string, any>;
e2eConfig.bots = { ...(e2eConfig.bots ?? {}), enabled: 0 };
writeFileSync(e2eConfigPath, JSON.stringify(e2eConfig, null, 2));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: isCi ? 1 : 0,
  // Headless Linux CI has no GPU and renders through SwiftShader. At the
  // "auto" quality the first frame takes ~28s and subsequent frames 4-13s, so
  // a spectator page needs ~70s to reach "Live". E2E asserts behaviour, not
  // visual fidelity, so every context starts in "low" quality (see
  // storageState below) and the timeouts cover a cold software renderer.
  timeout: 120_000,
  expect: { timeout: 60_000 },
  reporter: isCi
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    // Force the cheap render preset for every test context. This is only
    // initial localStorage; player cookies are still issued by the backend
    // after POST /session, so session-based identity is unaffected.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:5173",
          localStorage: [{ name: "snake-quality", value: "low" }],
        },
      ],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: [
    {
      command:
        "uv run --frozen uvicorn server:app --host 127.0.0.1 --port 8000 --ws-per-message-deflate false --ws-max-size 4096",
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
      // E2E must exercise the production bundle: Vite dev loads the spectator
      // chunk via a dynamic import that is flaky on CI. `preview` serves `dist/`
      // and proxies same-origin "/ws" to the backend (see vite.config.ts).
      // The build runs beforehand via the `pretest:e2e` npm lifecycle hook, so
      // webServer owns a single process (`vite preview`) instead of a shell
      // running `build && preview`, which Playwright could not terminate.
      command: "npm run preview:e2e",
      url: "http://127.0.0.1:5173",
      timeout: 120_000,
      reuseExistingServer: !isCi,
      env: {
        E2E_BACKEND_URL: process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000",
      },
    },
  ],
});
