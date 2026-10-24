/**
 * Runs the full twin sync for one wallet outside the web app (used by the seed script).
 *   pnpm sync:wallet <address>
 */
import { parseSuiAddress } from "@/lib/auth/message";
import { db } from "@/lib/db";
import { refreshWrites } from "@/lib/memory";
import { runSync, startSyncRun } from "@/lib/sync/run";

async function main(): Promise<void> {
  const address = parseSuiAddress(process.argv[2] ?? "");
  if (!address) throw new Error("usage: pnpm sync:wallet <sui address>");

  await db.user.upsert({ where: { address }, create: { address }, update: {} });
  const { runId } = await startSyncRun(address);
  process.stdout.write(`sync ${runId} for ${address}\n`);
  await runSync(runId, address);

  const run = await db.syncRun.findUniqueOrThrow({ where: { id: runId } });
  const memory = await refreshWrites(address);
  process.stdout.write(`status   ${run.status}${run.error ? ` (${run.error})` : ""}\n`);
  process.stdout.write(`progress ${run.progress}\n`);
  process.stdout.write(`memory   ${JSON.stringify(memory)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
