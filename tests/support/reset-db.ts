import { execSync } from "node:child_process";

const WIPE_SQL = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;";

/**
 * Empties a throwaway Postgres database and applies the real migrations. Refuses any database
 * whose name doesn't mark it as a test or e2e one, so it can never wipe dev or production data.
 */
export function resetDatabase(url: string): void {
  const name = new URL(url).pathname.slice(1);
  if (!/(^|_)(test|e2e)(_|$)/.test(name)) {
    throw new Error(`Refusing to reset "${name}": only *_test or *_e2e databases can be reset.`);
  }
  const options = { env: { ...process.env, DATABASE_URL: url } };
  execSync("pnpm prisma db execute --stdin", { ...options, input: WIPE_SQL, stdio: ["pipe", "ignore", "inherit"] });
  execSync("pnpm prisma migrate deploy", { ...options, stdio: "ignore" });
}
