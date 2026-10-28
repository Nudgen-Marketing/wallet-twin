import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against an isolated dev server: its own build dir, its own SQLite
 * database (seeded deterministically) and the local memory backend, so runs never
 * touch your dev database or write test twins to Walrus. Flows that inherently need
 * the chain (sign-in sync, following a twin) still call Tatum with your key.
 */

// E2E_PORT runs a second suite side by side (e.g. another checkout's server holds 3100);
// it gets its own database and build dir so the two never share state.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const SUFFIX = PORT === 3100 ? "" : `-${PORT}`;
export const E2E_BASE_URL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL = `file:./prisma/e2e${SUFFIX}.db`;
export const E2E_DEMO_WALLETS = [
  "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940",
  "0x4999139366a0c303b7cf1e683d24d1d8adb0de38e342fdfdee8788f8d1976c58",
];

export const E2E_ENV = {
  DATABASE_URL: E2E_DATABASE_URL,
  // Under build/: already ignored by git and ESLint.
  NEXT_DIST_DIR: `build/e2e${SUFFIX}`,
  NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
  DEMO_WALLETS: E2E_DEMO_WALLETS.join(","),
  // Empty values win over .env files: the app falls back to its local memory store.
  MEMWAL_PRIVATE_KEY: "",
  MEMWAL_ACCOUNT_ID: "",
};

export default defineConfig({
  testDir: "./e2e",
  // One dev server and one SQLite file: run serially for deterministic state.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  outputDir: "build/test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "build/playwright-report" }]],
  use: {
    baseURL: E2E_BASE_URL,
    // Uses the system Chrome; no Playwright browser download needed.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome" }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // Rebuild the e2e database first, then start the isolated dev server.
    // `exec` hands the shell's PID to next itself, so shutdown reaches the server (no strays on :3100).
    command: `pnpm exec tsx e2e/prepare-db.ts && exec node node_modules/next/dist/bin/next dev --port ${PORT}`,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: E2E_ENV,
  },
});
