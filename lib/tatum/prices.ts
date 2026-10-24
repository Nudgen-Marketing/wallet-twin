import { z } from "zod";
import type { TatumHttp } from "@/lib/tatum/http";
import { TatumHttpError } from "@/lib/tatum/http";
import type { UsdPrice } from "@/lib/tatum/types";

/**
 * Historical USD prices from Tatum's OHLCV endpoint
 * (https://docs.tatum.io/reference/getsymbolohlcv). Each call costs 50 credits,
 * so callers must cache by (symbol, candle).
 */

export const OHLCV_URL = "https://api.tatum.io/v4/data/rate/symbol/OHLCV";

/**
 * Canonical Sui coin type → Tatum OHLCV symbol. Keyed by coin type, never by on-chain
 * symbol, so an impostor coin calling itself "USDC" is never priced as USDC.
 * Each entry verified 2026-10-24: coinMetadata via Tatum GraphQL + a live OHLCV call.
 * Not supported by Tatum OHLCV (→ value unknown): USDT, DEEP, NAVX, BLUE, NS, SCA.
 */
export const PRICEABLE_COINS: Readonly<Record<string, { symbol: string; decimals: number }>> = {
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI": {
    symbol: "SUI",
    decimals: 9,
  },
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC": {
    symbol: "USDC",
    decimals: 6,
  },
  "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL": {
    symbol: "WAL",
    decimals: 9,
  },
  "0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b::cetus::CETUS": {
    symbol: "CETUS",
    decimals: 9,
  },
  "0x3a304c7feba2d819ea57c3542d68439ca2c386ba02159c740f7b406e592c62ea::haedal::HAEDAL": {
    symbol: "HAEDAL",
    decimals: 9,
  },
};

export type CandleInterval = "1h" | "4h" | "1d";

export const INTERVAL_MS: Record<CandleInterval, number> = {
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

/**
 * The endpoint returns the *closest* candle even when the requested time is outside
 * its data (earliest/latest record). Anything further away than this many candles
 * is treated as "no price" rather than a guess.
 */
const MAX_CANDLE_DISTANCE = 2;

const candleSchema = z.object({
  symbol: z.string(),
  openTime: z.number(),
  closeTime: z.number(),
  close: z.string(),
});

export interface TatumPrices {
  /** USD close of the candle containing `atMs`, or null when Tatum has no usable candle. */
  usdPriceAt(symbol: string, atMs: number, interval?: CandleInterval): Promise<UsdPrice | null>;
}

export function candleStart(atMs: number, interval: CandleInterval): number {
  return Math.floor(atMs / INTERVAL_MS[interval]) * INTERVAL_MS[interval];
}

export function createTatumPrices({ apiKey, http }: { apiKey: string; http: TatumHttp }): TatumPrices {
  return {
    async usdPriceAt(symbol, atMs, interval = "1h") {
      const params = new URLSearchParams({
        symbol,
        unix: String(candleStart(atMs, interval)),
        interval,
      });
      let response: Response;
      try {
        response = await http.request(`${OHLCV_URL}?${params}`, {
          headers: { "x-api-key": apiKey, accept: "application/json" },
        });
      } catch (error: unknown) {
        // 404 = Tatum has no data for this symbol: a legitimate "unknown", not a failure.
        if (error instanceof TatumHttpError && error.status === 404) return null;
        throw error;
      }

      const candle = candleSchema.parse(await response.json());
      const usd = Number(candle.close);
      const distance = Math.abs(candle.openTime - candleStart(atMs, interval));
      if (!Number.isFinite(usd) || usd <= 0) return null;
      if (distance > MAX_CANDLE_DISTANCE * INTERVAL_MS[interval]) return null;

      return {
        symbol: candle.symbol,
        usd,
        candleOpenMs: candle.openTime,
        candleCloseMs: candle.closeTime,
      };
    },
  };
}
