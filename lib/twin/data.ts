import "server-only";
import { db } from "@/lib/db";
import { computeStats, type TwinStats } from "@/lib/trades/stats";
import type { ValuedActivity } from "@/lib/trades/types";
import { computeFeatures, type TwinFeatures } from "@/lib/twin/features";

export interface TwinSnapshot {
  activities: ValuedActivity[];
  stats: TwinStats;
  features: TwinFeatures;
}

export async function loadActivities(address: string): Promise<ValuedActivity[]> {
  const rows = await db.activity.findMany({ where: { address }, orderBy: { timestamp: "asc" } });
  // Rows are written only by our own sync from validated, typed values.
  return rows.map((row) => JSON.parse(row.data) as ValuedActivity);
}

export async function loadTwinSnapshot(address: string): Promise<TwinSnapshot> {
  const activities = await loadActivities(address);
  const stats = computeStats(activities);
  return { activities, stats, features: computeFeatures(activities, stats) };
}

/** Persists new activity rows; returns only the ones that weren't stored before. */
export async function storeActivities(address: string, activities: ValuedActivity[]): Promise<ValuedActivity[]> {
  if (activities.length === 0) return [];
  const existing = await db.activity.findMany({
    where: { address, digest: { in: activities.map((activity) => activity.digest) } },
    select: { digest: true },
  });
  const known = new Set(existing.map((row) => row.digest));
  const fresh = activities.filter((activity) => !known.has(activity.digest));
  if (fresh.length > 0) {
    await db.activity.createMany({
      data: fresh.map((activity) => ({
        address,
        digest: activity.digest,
        checkpoint: activity.checkpoint,
        timestamp: new Date(activity.timestampMs),
        kind: activity.kind,
        usdValue: activity.usdValue,
        data: JSON.stringify(activity),
      })),
    });
  }
  return fresh;
}
