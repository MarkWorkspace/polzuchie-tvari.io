// ROLE: Конфигурация Vite (сборка) и Vitest (тесты). Единственная точка настройки фронтенд-сборки и тестов.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Repo root — используется для чтения общего JSON c бэкендом из tests_shared/.
const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export default defineConfig({
  test: {
    // Математика и декодер работают в чистом node — DOM не нужен.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Доступ к tests_shared/ на корне репо через алиас '@fixtures'.
    alias: {
      "@fixtures": fileURLToPath(new URL("./fixtures/", import.meta.url)),
      "@shared-vectors": fileURLToPath(new URL("../tests_shared/", import.meta.url)),
    },
  },
});
