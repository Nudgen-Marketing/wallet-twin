import "server-only";
import { db } from "@/lib/db";
import { latestMemories } from "@/lib/memory";
import { STABLE_COIN_TYPES } from "@/lib/trades/stats";
import { loadTwinSnapshot } from "@/lib/twin/data";

/** Removes the "(as of 2026-10-24)" stamp we put on regenerated memories. */
export function stripAsOf(text: string): string {
  return text.replace(/^\[\w+\]\s*/, "").replace(/^\(as of [\d-]+\)\s*/, "").trim();
}

export function firstSentence(text: string, maxLength = 160): string {
  const sentence = /^.*?[.!?](\s|$)/.exec(text)?.[0].trim() ?? text;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1)}…` : sentence;
}

export async function isPublished(address: string): Promise<boolean> {
  return (await db.publicTwin.count({ where: { address } })) > 0;
}

/**
 * Recomputes a published twin's leaderboard row. `copyReturnPct` is supplied by the
 * paper-trading engine when available.
 */
export async function refreshLeaderboardEntry(address: string, copyReturnPct?: number | null): Promise<void> {
  if (!(await isPublished(address))) return;
  const [{ stats }, profile] = await Promise.all([
    loadTwinSnapshot(address),
    latestMemories(address, "profile", { query: "trading style profile summary" }),
  ]);
  const favorite = stats.favoriteTokens.find(
    (token) => token.symbol && token.symbol !== "SUI" && !STABLE_COIN_TYPES.has(token.coinType),
  );
  const data = {
    swaps: stats.swapCount,
    closedTrades: stats.closedTrades,
    winRate: stats.winRate,
    realizedPnlUsd: stats.realizedPnlUsd,
    volumeUsd: stats.tradedVolumeUsd,
    favoriteToken: favorite?.symbol ?? stats.favoriteTokens[0]?.symbol ?? null,
    headline: profile[0] ? firstSentence(stripAsOf(profile[0].text)) : null,
    ...(copyReturnPct !== undefined ? { copyReturnPct } : {}),
  };
  await db.leaderboardEntry.upsert({ where: { address }, create: { address, ...data }, update: data });
}

export async function publishTwin(address: string): Promise<void> {
  await db.publicTwin.upsert({ where: { address }, create: { address }, update: {} });
  await refreshLeaderboardEntry(address);
}

/** Unpublishing removes the twin from the leaderboard and closes its public page and chat. */
export async function unpublishTwin(address: string): Promise<void> {
  await db.$transaction([
    db.publicTwin.deleteMany({ where: { address } }),
    db.leaderboardEntry.deleteMany({ where: { address } }),
  ]);
}

export interface LeaderboardRow {
  rank: number;
  address: string;
  swaps: number;
  closedTrades: number;
  winRate: number | null;
  realizedPnlUsd: number;
  volumeUsd: number;
  copyReturnPct: number | null;
  favoriteToken: string | null;
  headline: string | null;
}

/** Twins need a few closed trades before their win rate means anything. */
const MIN_CLOSED_TRADES_FOR_RANK = 3;

/**
 * Ranked by simulated copy return, then win rate, then realized PnL. Twins without
 * enough closed trades sort after ranked ones.
 */
export function rankLeaderboard(entries: Omit<LeaderboardRow, "rank">[]): LeaderboardRow[] {
  const score = (entry: Omit<LeaderboardRow, "rank">) => [
    entry.closedTrades >= MIN_CLOSED_TRADES_FOR_RANK ? 1 : 0,
    entry.copyReturnPct ?? Number.NEGATIVE_INFINITY,
    entry.winRate ?? -1,
    entry.realizedPnlUsd,
  ];
  return [...entries]
    .sort((a, b) => {
      const [sa, sb] = [score(a), score(b)];
      for (let index = 0; index < sa.length; index += 1) {
        if (sa[index] !== sb[index]) return sb[index] - sa[index];
      }
      return a.address.localeCompare(b.address);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const rows = await db.leaderboardEntry.findMany({
    where: { address: { in: (await db.publicTwin.findMany({ select: { address: true } })).map((row) => row.address) } },
  });
  return rankLeaderboard(
    rows.map((row) => ({
      address: row.address,
      swaps: row.swaps,
      closedTrades: row.closedTrades,
      winRate: row.winRate,
      realizedPnlUsd: row.realizedPnlUsd,
      volumeUsd: row.volumeUsd,
      copyReturnPct: row.copyReturnPct,
      favoriteToken: row.favoriteToken,
      headline: row.headline,
    })),
  ).slice(0, limit);
}
