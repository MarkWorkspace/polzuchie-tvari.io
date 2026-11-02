// ROLE: Конфигурация Vite (сборка с vendor-chunks) и Vitest (тесты). Единственная точка настройки фронтенд-сборки и тестов.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Production build uses same-origin WebSocket/admin URLs ("/ws"). Dev and preview
// therefore need a proxy to the backend; E2E can point it at another backend port.
const backendUrl = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
const backendProxy = {
  "/ws": {
    target: backendUrl,
    ws: true,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: backendProxy },
  preview: { proxy: backendProxy },
  build: {
    rolldownOptions: {
      output: {
        // Keep large third-party libraries in cacheable chunks. Three/postprocessing
        // are only reachable from the dynamically imported game/spectator modules.
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-three",
              test: /[\\/]node_modules[\\/](?:three|postprocessing)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    // Математика и декодер работают в чистом node — DOM не нужен.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Доступ к tests_shared/ на корне репо через алиас '@shared-vectors'.
    alias: {
      "@shared-vectors": fileURLToPath(new URL("../tests_shared/", import.meta.url)),
    },
  },
});
