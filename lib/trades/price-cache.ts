import "server-only";
import { db } from "@/lib/db";
import { getUsdPriceAt } from "@/lib/tatum";
import { candleStart, PRICEABLE_COINS } from "@/lib/tatum/prices";
import type { PriceLookup } from "@/lib/trades/value";

/** Default cap on fresh OHLCV calls per sync (50 credits each). */
export const DEFAULT_PRICE_BUDGET = 150;

const INTERVAL = "1h" as const;

const keyOf = (symbol: string, startMs: number) => `${symbol}|${startMs}`;

export interface ResolvedPrices {
  lookup: PriceLookup;
  fetched: number;
  /** Requests skipped because the budget ran out (their values stay unknown). */
  skipped: number;
}

/**
 * Resolves hourly USD prices for the requested (coin, time) pairs. Only allowlisted coin
 * types are priced; cache hits are free; misses cost one Tatum call each until `budget`
 * runs out. "No data" answers are cached too.
 */
export async function resolvePrices(
  requests: { coinType: string; atMs: number }[],
  budget: number = DEFAULT_PRICE_BUDGET,
): Promise<ResolvedPrices> {
  const needed = new Map<string, { symbol: string; startMs: number }>();
  for (const { coinType, atMs } of requests) {
    const coin = PRICEABLE_COINS[coinType];
    if (!coin) continue;
    const startMs = candleStart(atMs, INTERVAL);
    needed.set(keyOf(coin.symbol, startMs), { symbol: coin.symbol, startMs });
  }

  const prices = new Map<string, number | null>();
  const wanted = [...needed.values()];
  const cached = await db.priceCache.findMany({
    where: {
      OR: wanted.map(({ symbol, startMs }) => ({ symbol, candleStart: new Date(startMs) })),
    },
  });
  for (const row of cached) prices.set(keyOf(row.symbol, row.candleStart.getTime()), row.usd);

  let fetched = 0;
  let skipped = 0;
  for (const { symbol, startMs } of wanted) {
    const key = keyOf(symbol, startMs);
    if (prices.has(key)) continue;
    if (fetched >= budget) {
      skipped += 1;
      continue;
    }
    fetched += 1;
    try {
      const price = await getUsdPriceAt(symbol, startMs, INTERVAL);
      const usd = price?.usd ?? null;
      prices.set(key, usd);
      await db.priceCache.upsert({
        where: { symbol_candleStart: { symbol, candleStart: new Date(startMs) } },
        create: { symbol, candleStart: new Date(startMs), usd },
        update: { usd, fetchedAt: new Date() },
      });
    } catch (error: unknown) {
      // Transient failure: leave unknown and don't cache, so a later sync can retry.
      console.error("[prices] OHLCV lookup failed", symbol, error instanceof Error ? error.message : error);
    }
  }

  return {
    fetched,
    skipped,
    lookup: (coinType, atMs) => {
      const coin = PRICEABLE_COINS[coinType];
      if (!coin) return null;
      return prices.get(keyOf(coin.symbol, candleStart(atMs, INTERVAL))) ?? null;
    },
  };
}
