import { resetDatabase } from "./reset-db";

/** Empties the integration-test database (set in vitest.config.mts) and migrates it with the real migrations. */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set; vitest.config.mts sets a local default.");
  resetDatabase(url);
}
