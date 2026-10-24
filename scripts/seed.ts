/**
 * Seeds the demo twins: syncs each demo wallet (Tatum → parser → Walrus Memory) and
 * publishes it so judges can explore without a wallet.
 *   pnpm seed
 */
import { db } from "@/lib/db";
import { demoWallets } from "@/lib/demo";
import { refreshWrites } from "@/lib/memory";
import { runSync, startSyncRun } from "@/lib/sync/run";
import { getLeaderboard, publishTwin } from "@/lib/twin/publish";

async function main(): Promise<void> {
  for (const wallet of demoWallets()) {
    process.stdout.write(`\n▶ ${wallet.label} (${wallet.address})\n`);
    await db.user.upsert({ where: { address: wallet.address }, create: { address: wallet.address }, update: {} });
    const { runId } = await startSyncRun(wallet.address);
    await runSync(runId, wallet.address);
    const run = await db.syncRun.findUniqueOrThrow({ where: { id: runId } });
    process.stdout.write(`  sync ${run.status}${run.error ? `: ${run.error}` : ""} ${run.progress}\n`);
    if (run.status !== "done") continue;
    await publishTwin(wallet.address);
    process.stdout.write(`  memory ${JSON.stringify(await refreshWrites(wallet.address))}\n`);
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
