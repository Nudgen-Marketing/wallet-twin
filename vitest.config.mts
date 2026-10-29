import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Throwaway Postgres database for integration tests (wiped by tests/support/db-setup.ts on every run).
// CI points TEST_DATABASE_URL at its service container.
const TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL ??= `postgresql://${process.env.USER}@localhost:5432/wallet_twin_test`);

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
    // Integration tests share one Postgres database.
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "test-secret-that-is-at-least-32-characters-long",
      // No MemWal/LLM credentials in tests: the local memory backend and template narrative are used.
      MEMWAL_PRIVATE_KEY: "",
      MEMWAL_ACCOUNT_ID: "",
      ANTHROPIC_API_KEY: "",
    },
  },
});
