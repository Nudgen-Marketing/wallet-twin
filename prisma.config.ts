import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js reads .env.local and .env; load the same files (local wins) so the CLI and app share one database.
config({ path: [".env.local", ".env"], quiet: true });

// Read process.env directly rather than prisma's env(), which throws when unset: `prisma generate`
// runs as postinstall in CI and the Docker deps stage with no database configured.

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
