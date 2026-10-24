import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasLanguageModel, languageModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { STABLE_COIN_TYPES, type TwinStats } from "@/lib/trades/stats";
import { loadTwinSnapshot } from "@/lib/twin/data";
import type { TwinFeatures } from "@/lib/twin/features";
import { formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";
import { factSheet } from "@/lib/twin/narrative";

export interface WrappedCard {
  address: string;
  fromMs: number | null;
  toMs: number | null;
  swaps: number;
  winRate: number | null;
  realizedPnlUsd: number | null;
  favoriteToken: string | null;
  avgHoldingMs: number | null;
  biggestWin: { symbol: string; pnlUsd: number } | null;
  line: string;
}

/** Deterministic one-liner used without an LLM (or when it fails). */
export function fallbackLine(stats: TwinStats, features: TwinFeatures): string {
  if (stats.swapCount === 0) return "A wallet of few words and fewer swaps. Mysterious.";
  if (features.shortHoldShare !== null && features.shortHoldShare > 0.7) {
    return `Median hold: ${formatDuration(features.medianHoldingMs)}. Commitment issues, but make it on-chain.`;
  }
  if (stats.winRate !== null && stats.winRate >= 0.6) {
    return `Won ${formatPercent(stats.winRate)} of closed trades. The chain noticed.`;
  }
  return `${stats.swapCount.toLocaleString()} swaps, ${formatPercent(stats.winRate)} hit rate, zero regrets (allegedly).`;
}

const lineSchema = z.object({
  line: z.string().max(140).describe("One witty, kind roast of this trader, ≤ 14 words, citing one real number."),
});

async function wittyLine(address: string, stats: TwinStats, features: TwinFeatures, dataKey: string): Promise<string> {
  const cached = await db.wrappedLine.findUnique({ where: { address } });
  if (cached?.dataKey === dataKey) return cached.line;

  let line = fallbackLine(stats, features);
  if (hasLanguageModel() && stats.swapCount > 0) {
    try {
      const { output } = await generateText({
        model: languageModel(),
        output: Output.object({ schema: lineSchema }),
        system:
          "You write the one-liner for a 'Wallet Wrapped' card. Use only the facts given, quote at most one number, " +
          "be playful not mean, no financial advice, no hashtags or emojis.",
        prompt: factSheet(stats, features),
      });
      line = output.line;
    } catch (error: unknown) {
      console.error("[wrapped] line generation failed", error instanceof Error ? error.message : error);
    }
  }
  await db.wrappedLine.upsert({
    where: { address },
    create: { address, dataKey, line },
    update: { dataKey, line, createdAt: new Date() },
  });
  return line;
}

export async function buildWrappedCard(address: string): Promise<WrappedCard> {
  const { activities, stats, features } = await loadTwinSnapshot(address);
  const dataKey = `${activities.length}:${activities.at(-1)?.digest ?? "none"}`;
  // The interesting favorite is what they actually trade, not the stablecoin or SUI they pay with.
  const favorite =
    stats.favoriteTokens.find((token) => token.symbol && token.symbol !== "SUI" && !STABLE_COIN_TYPES.has(token.coinType)) ??
    stats.favoriteTokens[0];
  return {
    address,
    fromMs: stats.firstActivityMs,
    toMs: stats.lastActivityMs,
    swaps: stats.swapCount,
    winRate: stats.winRate,
    realizedPnlUsd: stats.closedTrades > 0 ? stats.realizedPnlUsd : null,
    favoriteToken: favorite?.symbol ?? null,
    avgHoldingMs: stats.avgHoldingMs,
    biggestWin: stats.biggestWin
      ? { symbol: stats.biggestWin.symbol ?? "?", pnlUsd: stats.biggestWin.pnlUsd }
      : null,
    line: await wittyLine(address, stats, features, dataKey),
  };
}

export function wrappedShareText(card: WrappedCard): string {
  const pnl = card.realizedPnlUsd === null ? "" : ` · ${formatUsd(card.realizedPnlUsd, { signed: true })} realized`;
  return `My Sui Wallet Wrapped: ${card.swaps.toLocaleString()} swaps · ${formatPercent(card.winRate)} win rate${pnl}. "${card.line}"`;
}
