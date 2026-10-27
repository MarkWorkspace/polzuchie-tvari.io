// ROLE: Конфигурация Vite (сборка) и Vitest (тесты). Единственная точка настройки фронтенд-сборки и тестов.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
