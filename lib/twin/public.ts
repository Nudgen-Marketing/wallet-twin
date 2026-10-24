import "server-only";
import { db } from "@/lib/db";
import { latestMemories } from "@/lib/memory";
import type { TwinStats } from "@/lib/trades/stats";
import { loadTwinSnapshot } from "@/lib/twin/data";
import { stripAsOf } from "@/lib/twin/publish";

export interface PublicTwinView {
  address: string;
  publishedAt: Date;
  historyFromMs: number | null;
  profile: string | null;
  insights: string[];
  milestones: string[];
  stats: TwinStats;
}

function uniqueTexts(texts: string[], limit: number): string[] {
  return [...new Set(texts.map(stripAsOf))].slice(0, limit);
}

/**
 * Everything a visitor may see about a twin — only for published twins, and only the
 * public memory types (profile, insight, milestone) plus aggregate stats.
 */
export async function loadPublicTwin(address: string): Promise<PublicTwinView | null> {
  const published = await db.publicTwin.findUnique({ where: { address } });
  if (!published) return null;

  const [snapshot, state, profile, insights, milestones] = await Promise.all([
    loadTwinSnapshot(address),
    db.syncState.findUnique({ where: { address } }),
    latestMemories(address, "profile", { query: "trading style profile summary" }),
    latestMemories(address, "insight", { query: "trading habit pattern", limit: 12 }),
    latestMemories(address, "milestone", { query: "first record biggest win loss", limit: 12 }),
  ]);

  return {
    address,
    publishedAt: published.publishedAt,
    historyFromMs: state?.historyFromMs?.getTime() ?? null,
    profile: profile[0] ? stripAsOf(profile[0].text) : null,
    insights: uniqueTexts(insights.map((memory) => memory.text), 5),
    milestones: uniqueTexts(milestones.map((memory) => memory.text), 6),
    stats: snapshot.stats,
  };
}
