import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasLanguageModel, languageModel } from "@/lib/ai";
import type { TwinStats } from "@/lib/trades/stats";
import type { TwinFeatures } from "@/lib/twin/features";
import { formatDuration, formatPercent, formatUsd } from "@/lib/twin/format";

export interface TwinNarrative {
  profile: string;
  insights: string[];
}

const narrativeSchema = z.object({
  profile: z
    .string()
    .describe("3–4 sentences, third person ('This wallet…'), describing trading style. Only use the facts given."),
  insights: z
    .array(z.string().describe("One concrete, data-backed pattern or habit, ≤ 30 words, citing a number."))
    .min(2)
    .max(6),
});

/** Plain-text fact sheet the model must stay within. Exported for tests and the chat prompt. */
export function factSheet(stats: TwinStats, features: TwinFeatures): string {
  const tokens = stats.favoriteTokens.map((token) => `${token.symbol ?? "?"} (${token.trades} swaps)`).join(", ");
  const pnl = features.pnlByToken.map((token) => `${token.symbol} ${formatUsd(token.pnlUsd, { signed: true })} over ${token.trades}`).join("; ");
  return [
    `Activity: ${JSON.stringify(stats.activityCounts)}`,
    `Swaps: ${stats.swapCount} (${stats.pricedSwapCount} with known USD value), volume ${formatUsd(stats.tradedVolumeUsd)}`,
    `Closed trades with known cost basis: ${stats.closedTrades}, win rate ${formatPercent(stats.winRate)}, realized PnL estimate ${formatUsd(stats.realizedPnlUsd, { signed: true })}`,
    `Average holding time (sold positions): ${formatDuration(stats.avgHoldingMs)}; median ${formatDuration(features.medianHoldingMs)}; share held < 2 days ${formatPercent(features.shortHoldShare)}`,
    `Swaps per active day: ${features.swapsPerActiveDay?.toFixed(1) ?? "—"}; busiest hour (UTC) ${features.busiestHourUtc ?? "—"}; busiest weekday ${features.busiestWeekday ?? "—"}`,
    `Share of swaps in long-tail tokens (not SUI/major/stable): ${formatPercent(features.longTailShare)}; distinct tokens ${features.distinctTokens}`,
    `Average trade size: ${formatUsd(features.avgTradeUsd)}; share paid with stablecoins ${formatPercent(features.stableShareOfBuys)}`,
    `Longest losing streak: ${features.longestLosingStreak}`,
    `Favorite tokens: ${tokens || "—"}`,
    `PnL by token: ${pnl || "—"}`,
    `NFT actions: ${stats.nftCount}`,
  ].join("\n");
}

/** Template narrative used when no LLM key is configured (or the call fails). */
export function fallbackNarrative(stats: TwinStats, features: TwinFeatures): TwinNarrative {
  const style =
    features.shortHoldShare !== null && features.shortHoldShare > 0.6
      ? "a fast in-and-out trader"
      : stats.swapCount > 0
        ? "a patient position holder"
        : "mostly a holder and transferrer";
  return {
    profile: `This wallet is ${style}, with ${stats.swapCount} swaps on record and a realized PnL estimate of ${formatUsd(stats.realizedPnlUsd, { signed: true })}. Its favorite tokens are ${stats.favoriteTokens.map((t) => t.symbol).join(", ") || "not yet clear"}.`,
    insights: [
      `Win rate on closed trades is ${formatPercent(stats.winRate)} across ${stats.closedTrades} trades.`,
      `Median holding time is ${formatDuration(features.medianHoldingMs)}.`,
      `${formatPercent(features.longTailShare)} of swaps touch long-tail tokens.`,
    ],
  };
}

export async function generateNarrative(stats: TwinStats, features: TwinFeatures): Promise<TwinNarrative> {
  if (!hasLanguageModel() || stats.swapCount === 0) return fallbackNarrative(stats, features);
  try {
    const { output } = await generateText({
      model: languageModel(),
      output: Output.object({ schema: narrativeSchema }),
      system:
        "You analyse a crypto wallet's trading behaviour for an 'AI twin' product. Use ONLY the facts provided. " +
        "Never invent numbers, tokens or events. Be specific and a little witty, never give financial advice.",
      prompt: `Facts about this Sui wallet (computed from on-chain data via Tatum):\n${factSheet(stats, features)}\n\nWrite the profile and insights.`,
    });
    return output;
  } catch (error: unknown) {
    console.error("[twin] narrative generation failed", error instanceof Error ? error.message : error);
    return fallbackNarrative(stats, features);
  }
}
