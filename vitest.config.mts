import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside React Server Components; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/db-setup.ts"],
    // Integration tests share one SQLite file.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./prisma/test.db",
      SESSION_SECRET: "test-secret-that-is-at-least-32-characters-long",
      // No MemWal/LLM credentials in tests: the local memory backend and template narrative are used.
      MEMWAL_PRIVATE_KEY: "",
      MEMWAL_ACCOUNT_ID: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
