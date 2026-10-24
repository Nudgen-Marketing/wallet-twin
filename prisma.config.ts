import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js reads .env.local; load the same file so the CLI and the app share one database.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
