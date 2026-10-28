import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import type { ClosedTrade, TwinStats } from "@/lib/trades/stats";

/** JSON shapes MCP tools return. Times are ISO strings; USD values are estimates or null when unknown. */

const HOUR_MS = 3_600_000;

export const NOTICE = "Estimates from on-chain data. Copy trading is simulated. Not financial advice.";

export const addressInput = z
  .string()
  .min(3)
  .max(100)
  .describe("A Sui address, 0x-prefixed (e.g. from get_leaderboard or list_demo_twins).");

export function absoluteUrl(path: string): string {
  return new URL(path, env().NEXT_PUBLIC_APP_URL).toString();
}

export const iso = (ms: number | null): string | null => (ms === null ? null : new Date(ms).toISOString());
const hours = (ms: number | null): number | null => (ms === null ? null : Math.round((ms / HOUR_MS) * 10) / 10);

const tradeOutcomeSchema = z.object({
  symbol: z.string().nullable(),
  pnlUsd: z.number(),
  costUsd: z.number(),
  proceedsUsd: z.number(),
  holdingHours: z.number().nullable(),
  closedAt: z.string().nullable(),
  digest: z.string(),
});

export const statsSchema = z.object({
  swaps: z.number(),
  pricedSwaps: z.number(),
  tradedVolumeUsd: z.number(),
  closedTrades: z.number(),
  wins: z.number(),
  winRate: z.number().nullable().describe("0–1 over closed trades with a known cost basis."),
  realizedPnlUsd: z.number(),
  avgHoldingHours: z.number().nullable(),
  favoriteTokens: z.array(z.object({ symbol: z.string().nullable(), coinType: z.string(), trades: z.number() })),
  biggestWin: tradeOutcomeSchema.nullable(),
  worstLoss: tradeOutcomeSchema.nullable(),
  firstActivityAt: z.string().nullable(),
  lastActivityAt: z.string().nullable(),
  nftActions: z.number(),
  activityCounts: z.record(z.string(), z.number()),
});
export type StatsView = z.infer<typeof statsSchema>;

function tradeOutcome(trade: ClosedTrade | null): z.infer<typeof tradeOutcomeSchema> | null {
  if (!trade) return null;
  return {
    symbol: trade.symbol,
    pnlUsd: trade.pnlUsd,
    costUsd: trade.costUsd,
    proceedsUsd: trade.proceedsUsd,
    holdingHours: hours(trade.holdingMs),
    closedAt: iso(trade.timestampMs),
    digest: trade.digest,
  };
}

/** Aggregate stats without the per-trade `closed` list (list_my_trades pages through those). */
export function statsView(stats: TwinStats): StatsView {
  return {
    swaps: stats.swapCount,
    pricedSwaps: stats.pricedSwapCount,
    tradedVolumeUsd: stats.tradedVolumeUsd,
    closedTrades: stats.closedTrades,
    wins: stats.wins,
    winRate: stats.winRate,
    realizedPnlUsd: stats.realizedPnlUsd,
    avgHoldingHours: hours(stats.avgHoldingMs),
    favoriteTokens: stats.favoriteTokens.slice(0, 8),
    biggestWin: tradeOutcome(stats.biggestWin),
    worstLoss: tradeOutcome(stats.worstLoss),
    firstActivityAt: iso(stats.firstActivityMs),
    lastActivityAt: iso(stats.lastActivityMs),
    nftActions: stats.nftCount,
    activityCounts: Object.fromEntries(
      Object.entries(stats.activityCounts).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
    ),
  };
}
