import "server-only";
import { db } from "@/lib/db";
import { getCoinInfo } from "@/lib/tatum";
import { PRICEABLE_COINS } from "@/lib/tatum/prices";
import type { CoinMeta } from "@/lib/trades/value";

/** Symbol/decimals for each coin type: verified allowlist, then SQLite cache, then Tatum. */
export async function getCoinMetas(coinTypes: Iterable<string>): Promise<Map<string, CoinMeta>> {
  const wanted = [...new Set(coinTypes)];
  const metas = new Map<string, CoinMeta>();

  for (const coinType of wanted) {
    const known = PRICEABLE_COINS[coinType];
    if (known) metas.set(coinType, { symbol: known.symbol, decimals: known.decimals });
  }

  const missing = wanted.filter((coinType) => !metas.has(coinType));
  const cached = await db.coinInfo.findMany({ where: { coinType: { in: missing } } });
  for (const row of cached) metas.set(row.coinType, { symbol: row.symbol, decimals: row.decimals });

  for (const coinType of missing.filter((type) => !metas.has(type))) {
    try {
      const info = await getCoinInfo(coinType);
      await db.coinInfo.upsert({
        where: { coinType },
        create: { coinType, symbol: info.symbol, name: info.name, decimals: info.decimals },
        update: { symbol: info.symbol, name: info.name, decimals: info.decimals, fetchedAt: new Date() },
      });
      metas.set(coinType, { symbol: info.symbol, decimals: info.decimals });
    } catch (error: unknown) {
      // Unknown metadata just means "amount unknown" for this coin; don't fail the sync.
      console.error("[coins] metadata lookup failed", coinType, error instanceof Error ? error.message : error);
    }
  }
  return metas;
}
