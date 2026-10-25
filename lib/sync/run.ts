import "server-only";
import { db } from "@/lib/db";
import { memoryBackendName, rememberTwin, type TwinMemoryEntry } from "@/lib/memory";
import { getAddressHistory, getHistoryRange } from "@/lib/tatum";
import { analyzeTransactions } from "@/lib/trades/analyze";
import { loadTwinSnapshot, storeActivities } from "@/lib/twin/data";
import { formatDate } from "@/lib/twin/format";
import { milestoneMemories, tradeMemories } from "@/lib/twin/memories";
import { generateNarrative } from "@/lib/twin/narrative";
import { refreshLeaderboardEntry } from "@/lib/twin/publish";

/** Demo cap per sync: keeps Tatum credits and memory writes bounded. */
export const SYNC_TX_CAP = 1_000;
const STALE_RUN_MS = 10 * 60 * 1000;

export type SyncStage = "history" | "analyze" | "twin" | "memory" | "done";

export interface SyncProgress {
  transactions?: number;
  pages?: number;
  hitCap?: boolean;
  historyFromMs?: number | null;
  newActivities?: number;
  pricesFetched?: number;
  memoriesSubmitted?: number;
  memoriesSkipped?: number;
  memoriesFailed?: number;
}

async function update(runId: string, stage: SyncStage, progress: SyncProgress): Promise<void> {
  await db.syncRun.update({ where: { id: runId }, data: { stage, progress: JSON.stringify(progress) } });
}

/** Returns the in-flight run for this wallet, or creates a new one. */
export async function startSyncRun(address: string): Promise<{ runId: string; alreadyRunning: boolean }> {
  const running = await db.syncRun.findFirst({
    where: { address, status: "running", startedAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
    orderBy: { startedAt: "desc" },
  });
  if (running) return { runId: running.id, alreadyRunning: true };
  const run = await db.syncRun.create({ data: { address, status: "running", stage: "history" } });
  return { runId: run.id, alreadyRunning: false };
}

/**
 * The whole pipeline: Tatum history (incremental) → classify & price → stats →
 * profile/insights/milestones → Walrus Memory. Safe to re-run: activity rows and
 * memory writes are both keyed, so nothing is stored twice.
 */
export async function runSync(runId: string, address: string): Promise<void> {
  const progress: SyncProgress = {};
  try {
    const state = await db.syncState.findUnique({ where: { address } });
    const [history, range] = await Promise.all([
      getAddressHistory(address, {
        maxTransactions: SYNC_TX_CAP,
        afterCheckpoint: state?.lastCheckpoint ?? undefined,
        onPage: ({ fetched, pages }) => {
          progress.transactions = fetched;
          progress.pages = pages;
          void update(runId, "history", progress);
        },
      }),
      getHistoryRange(),
    ]);
    progress.transactions = history.transactions.length;
    progress.hitCap = history.hitCap;
    progress.historyFromMs = range?.firstTimestampMs ?? null;
    await update(runId, "analyze", progress);

    const analyzed = await analyzeTransactions(address, history.transactions);
    const fresh = await storeActivities(address, analyzed.activities);
    progress.newActivities = fresh.length;
    progress.pricesFetched = analyzed.pricesFetched;
    await update(runId, "twin", progress);

    const snapshot = await loadTwinSnapshot(address);
    const hasProfile =
      (await db.memoryWrite.count({
        where: { address, type: "profile", status: { not: "failed" }, backend: memoryBackendName() },
      })) > 0;
    const entries: TwinMemoryEntry[] = [
      // Newest trades overall (capped); the ledger skips any already stored on this backend,
      // so a backend switch back-fills and a normal re-sync adds only what's new.
      ...tradeMemories(snapshot.activities, snapshot.stats),
      ...milestoneMemories(snapshot.activities, snapshot.stats),
    ];
    // Only regenerate the narrative when something changed, so an idle re-sync writes nothing.
    if (fresh.length > 0 || !hasProfile) {
      const narrative = await generateNarrative(snapshot.stats, snapshot.features);
      const asOf = formatDate(Date.now());
      entries.push({ type: "profile", key: `profile:${runId}`, text: `(as of ${asOf}) ${narrative.profile}` });
      narrative.insights.forEach((insight, index) =>
        entries.push({ type: "insight", key: `insight:${runId}:${index}`, text: `(as of ${asOf}) ${insight}` }),
      );
    }
    await update(runId, "memory", progress);

    const written = await rememberTwin(address, entries);
    progress.memoriesSubmitted = written.submitted;
    progress.memoriesSkipped = written.skipped;
    progress.memoriesFailed = written.failed;
    // A failed profile/insight from an earlier run is superseded once this run's narrative
    // is stored; drop it so it doesn't linger as a permanent "failed" write.
    if (written.failed === 0 && entries.some((entry) => entry.type === "profile")) {
      await db.memoryWrite.deleteMany({
        where: {
          address,
          type: { in: ["profile", "insight"] },
          status: "failed",
          NOT: { key: { contains: runId } },
        },
      });
    }

    const newest = history.transactions.at(-1);
    await db.syncState.upsert({
      where: { address },
      create: {
        address,
        lastCheckpoint: newest?.checkpoint ?? null,
        lastDigest: newest?.digest ?? null,
        historyFromMs: range ? new Date(range.firstTimestampMs) : null,
        lastSyncedAt: new Date(),
      },
      update: {
        ...(newest ? { lastCheckpoint: newest.checkpoint, lastDigest: newest.digest } : {}),
        ...(range ? { historyFromMs: new Date(range.firstTimestampMs) } : {}),
        lastSyncedAt: new Date(),
      },
    });
    // Published twins keep their leaderboard row current (no-op for private twins).
    await refreshLeaderboardEntry(address);
    await db.syncRun.update({
      where: { id: runId },
      data: { status: "done", stage: "done", progress: JSON.stringify(progress), finishedAt: new Date() },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[sync] run failed", runId, message);
    await db.syncRun.update({
      where: { id: runId },
      data: { status: "failed", error: message, progress: JSON.stringify(progress), finishedAt: new Date() },
    });
  }
}
