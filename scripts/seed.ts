/**
 * Seeds the demo twins: syncs each demo wallet (Tatum → parser → Walrus Memory) and
 * publishes it so judges can explore without a wallet. Production servers also fill in
 * missing demo twins on start (instrumentation.ts); this re-syncs all of them.
 *   pnpm seed
 */
import { db } from "@/lib/db";
import { seedDemoTwins } from "@/lib/demo-seed";
import { getLeaderboard } from "@/lib/twin/publish";

async function main(): Promise<void> {
  for (const result of await seedDemoTwins({ onlyMissing: false })) {
    process.stdout.write(`\n▶ ${result.label} (${result.address})\n  ${result.outcome}${result.detail ? `: ${result.detail}` : ""}\n`);
  }
  const board = await getLeaderboard();
  process.stdout.write(`\nLeaderboard: ${board.map((row) => `#${row.rank} ${row.address.slice(0, 10)}…`).join(", ")}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
