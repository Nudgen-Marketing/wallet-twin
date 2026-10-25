import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js reads .env.local and .env; load the same files (local wins) so the CLI and app share one database.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
