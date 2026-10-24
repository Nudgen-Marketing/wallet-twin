import { PRICEABLE_COINS } from "@/lib/tatum/prices";
import { STABLE_COIN_TYPES, type TwinStats } from "@/lib/trades/stats";
import type { ValuedActivity } from "@/lib/trades/types";

/**
 * Behavioural features computed from data (never by the LLM), used to ground the
 * profile and insight generation so the model describes patterns instead of inventing them.
 */
export interface TwinFeatures {
  swapsPerActiveDay: number | null;
  busiestHourUtc: number | null;
  busiestWeekday: string | null;
  /** Share of swaps involving a token outside the majors/stables (memecoin proxy). */
  longTailShare: number | null;
  medianHoldingMs: number | null;
  shortHoldShare: number | null;
  avgTradeUsd: number | null;
  distinctTokens: number;
  longestLosingStreak: number;
  pnlByToken: { symbol: string; pnlUsd: number; trades: number }[];
  /** Share of swaps paid for with a stablecoin. */
  stableShareOfBuys: number | null;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function computeFeatures(activities: ValuedActivity[], stats: TwinStats): TwinFeatures {
  const swaps = activities.filter((activity) => activity.kind === "swap");
  const activeDays = new Set(swaps.map((swap) => Math.floor(swap.timestampMs / DAY_MS))).size;
  const isLongTail = (coinType: string) => !PRICEABLE_COINS[coinType] && !STABLE_COIN_TYPES.has(coinType);
  const priced = swaps.filter((swap) => swap.usdValue !== null);

  let streak = 0;
  let longestLosingStreak = 0;
  for (const trade of stats.closed) {
    streak = trade.pnlUsd < 0 ? streak + 1 : 0;
    longestLosingStreak = Math.max(longestLosingStreak, streak);
  }

  const byToken = new Map<string, { symbol: string; pnlUsd: number; trades: number }>();
  for (const trade of stats.closed) {
    const symbol = trade.symbol ?? trade.coinType.split("::").at(-1)!;
    const current = byToken.get(trade.coinType) ?? { symbol, pnlUsd: 0, trades: 0 };
    byToken.set(trade.coinType, { ...current, pnlUsd: current.pnlUsd + trade.pnlUsd, trades: current.trades + 1 });
  }

  const buysWithStables = swaps.filter((swap) => swap.legsOut.some((leg) => STABLE_COIN_TYPES.has(leg.coinType)));
  const holdTimes = stats.closed.map((trade) => trade.holdingMs);

  return {
    swapsPerActiveDay: activeDays > 0 ? swaps.length / activeDays : null,
    busiestHourUtc: mode(swaps.map((swap) => new Date(swap.timestampMs).getUTCHours())),
    busiestWeekday: (() => {
      const day = mode(swaps.map((swap) => new Date(swap.timestampMs).getUTCDay()));
      return day === null ? null : WEEKDAYS[day];
    })(),
    longTailShare:
      swaps.length > 0
        ? swaps.filter((swap) => [...swap.legsIn, ...swap.legsOut].some((leg) => isLongTail(leg.coinType))).length /
          swaps.length
        : null,
    medianHoldingMs: median(holdTimes),
    shortHoldShare: holdTimes.length > 0 ? holdTimes.filter((ms) => ms < 2 * DAY_MS).length / holdTimes.length : null,
    avgTradeUsd: priced.length > 0 ? priced.reduce((total, swap) => total + swap.usdValue!, 0) / priced.length : null,
    distinctTokens: new Set(swaps.flatMap((swap) => [...swap.legsIn, ...swap.legsOut].map((leg) => leg.coinType))).size,
    longestLosingStreak,
    pnlByToken: [...byToken.values()].sort((a, b) => Math.abs(b.pnlUsd) - Math.abs(a.pnlUsd)).slice(0, 6),
    stableShareOfBuys: swaps.length > 0 ? buysWithStables.length / swaps.length : null,
  };
}
