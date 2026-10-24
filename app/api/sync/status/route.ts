import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/http/api";
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

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Sign in to see your sync.", 401);
  const { address } = session;

  const [run, state, memory] = await Promise.all([
    db.syncRun.findFirst({ where: { address }, orderBy: { startedAt: "desc" } }),
    db.syncState.findUnique({ where: { address } }),
    refreshWrites(address),
  ]);

  const status: SyncStatus = {
    run: run
      ? {
          id: run.id,
          status: run.status as "running" | "done" | "failed",
          stage: run.stage as SyncStage,
          progress: JSON.parse(run.progress) as SyncProgress,
          // Internal errors stay in server logs; the UI gets a generic message.
          error: run.error ? "Sync hit a problem talking to Tatum or Walrus. Try again in a minute." : null,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString() ?? null,
        }
      : null,
    memory,
    lastSyncedAt: state?.lastSyncedAt?.toISOString() ?? null,
    historyFrom: state?.historyFromMs?.toISOString() ?? null,
  };
  return ok(status, { headers: { "Cache-Control": "no-store" } });
}
