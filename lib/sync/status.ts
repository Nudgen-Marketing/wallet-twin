import "server-only";
import { db } from "@/lib/db";
import { refreshWrites } from "@/lib/memory";
import type { SyncProgress, SyncStage } from "@/lib/sync/run";

export interface SyncStatus {
  run: {
    id: string;
    status: "running" | "done" | "failed";
    stage: SyncStage;
    progress: SyncProgress;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
  memory: { pending: number; done: number; failed: number; backend: "walrus" | "local" };
  lastSyncedAt: string | null;
  historyFrom: string | null;
}

/** Latest sync run, memory write counts and history window for one wallet. */
export async function getSyncStatus(address: string): Promise<SyncStatus> {
  const [run, state, memory] = await Promise.all([
    db.syncRun.findFirst({ where: { address }, orderBy: { startedAt: "desc" } }),
    db.syncState.findUnique({ where: { address } }),
    refreshWrites(address),
  ]);

  return {
    run: run
      ? {
          id: run.id,
          status: run.status as "running" | "done" | "failed",
          stage: run.stage as SyncStage,
          progress: JSON.parse(run.progress) as SyncProgress,
          // Internal errors stay in server logs; callers get a generic message.
          error: run.error ? "Sync hit a problem talking to Tatum or Walrus. Try again in a minute." : null,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
        }
      : null,
    memory,
    lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
    historyFrom: state?.historyFromMs?.toISOString() ?? null,
  };
}
