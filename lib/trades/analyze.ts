import "server-only";
import type { SuiTransaction } from "@/lib/tatum";
import { getCoinMetas } from "@/lib/trades/coins";
import { parseActivities } from "@/lib/trades/parse";
import { resolvePrices } from "@/lib/trades/price-cache";
import type { ValuedActivity } from "@/lib/trades/types";
import { priceRequests, valueActivity } from "@/lib/trades/value";

export interface AnalyzeResult {
  activities: ValuedActivity[];
  pricesFetched: number;
  pricesSkipped: number;
}

/** Tatum transactions → classified, USD-valued activity for one wallet. */
export async function analyzeTransactions(
  address: string,
  transactions: SuiTransaction[],
  options: { priceBudget?: number } = {},
): Promise<AnalyzeResult> {
  const parsed = parseActivities(transactions, address);
  const coinTypes = parsed.flatMap((activity) => [...activity.legsOut, ...activity.legsIn].map((leg) => leg.coinType));
  const [metas, prices] = await Promise.all([
    getCoinMetas(coinTypes),
    resolvePrices(priceRequests(parsed), options.priceBudget),
  ]);
  return {
    activities: parsed.map((activity) => valueActivity(activity, (type) => metas.get(type), prices.lookup)),
    pricesFetched: prices.fetched,
    pricesSkipped: prices.skipped,
  };
}
