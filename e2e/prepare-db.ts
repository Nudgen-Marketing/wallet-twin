/**
 * Fresh, migrated, seeded e2e database. Runs as part of the e2e web server command,
 * so the dev server never opens the database before it's been rebuilt.
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

if (!process.env.DATABASE_URL?.includes("e2e")) {
  throw new Error("prepare-db only runs against the e2e database (DATABASE_URL must contain 'e2e').");
}

rmSync(process.env.DATABASE_URL.replace(/^file:/, ""), { force: true });
execSync("pnpm prisma migrate deploy", { stdio: "ignore" });
execSync("pnpm exec tsx --conditions=react-server --env-file-if-exists=.env.local --env-file-if-exists=.env scripts/e2e-seed.ts", {
  stdio: "inherit",
});
