/**
 * Fresh, migrated, seeded e2e database. Runs as part of the e2e web server command,
 * so the dev server never opens the database before it's been rebuilt.
 */
import { execSync } from "node:child_process";
import { resetDatabase } from "../tests/support/reset-db";

if (!process.env.DATABASE_URL?.includes("e2e")) {
  throw new Error("prepare-db only runs against the e2e database (DATABASE_URL must contain 'e2e').");
}

resetDatabase(process.env.DATABASE_URL);
execSync("pnpm exec tsx --conditions=react-server --env-file-if-exists=.env.local --env-file-if-exists=.env scripts/e2e-seed.ts", {
  stdio: "inherit",
});
