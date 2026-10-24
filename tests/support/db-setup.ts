import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Fresh SQLite database for integration tests, migrated with the real migrations. */
export const TEST_DATABASE_URL = "file:./prisma/test.db";

export default function setup(): void {
  rmSync("prisma/test.db", { force: true });
  execSync("pnpm prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "ignore",
  });
}
