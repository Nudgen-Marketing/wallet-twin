import "server-only";
import { db } from "@/lib/db";
import { demoWallets } from "@/lib/demo";
import { refreshWrites } from "@/lib/memory";
import { runSync, startSyncRun } from "@/lib/sync/run";
import { publishTwin } from "@/lib/twin/publish";

export interface SeedResult {
  address: string;
  label: string;
  outcome: "seeded" | "skipped" | "failed";
  detail?: string;
}

/**
 * Syncs each demo wallet (Tatum → parser → Walrus Memory) and publishes it so judges can
 * explore without a wallet. With `onlyMissing`, wallets already on the leaderboard are left
 * alone, which makes it safe to run on every server start.
 */
export async function seedDemoTwins(options: { onlyMissing: boolean }): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  for (const wallet of demoWallets()) {
    const { address, label } = wallet;
    if (options.onlyMissing && (await db.leaderboardEntry.findUnique({ where: { address } }))) {
      results.push({ address, label, outcome: "skipped" });
      continue;
    }
    try {
      await db.user.upsert({ where: { address }, create: { address }, update: {} });
      const { runId } = await startSyncRun(address);
      await runSync(runId, address);
      const run = await db.syncRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status !== "done") {
        results.push({ address, label, outcome: "failed", detail: run.error ?? `sync ${run.status}` });
        continue;
      }
      await publishTwin(address);
      const memory = await refreshWrites(address);
      results.push({ address, label, outcome: "seeded", detail: `memory ${JSON.stringify(memory)}` });
    } catch (error: unknown) {
      results.push({ address, label, outcome: "failed", detail: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

/** Fills in missing demo twins after a deploy without holding up the server. */
export function seedDemoTwinsInBackground(): void {
  seedDemoTwins({ onlyMissing: true })
    .then((results) => {
      for (const result of results) {
        if (result.outcome === "skipped") continue;
        const log = result.outcome === "failed" ? console.error : console.info;
        log(`[seed] ${result.outcome} ${result.label} (${result.address})${result.detail ? `: ${result.detail}` : ""}`);
      }
    })
    .catch((error: unknown) => console.error("[seed] demo twins failed", error instanceof Error ? error.message : error));
}
