import { z } from "zod";
import { SPOT_TOKENS, type SpotSnapshot } from "@/lib/market/tokens";

export { SPOT_TOKENS, type SpotPrice, type SpotSnapshot } from "@/lib/market/tokens";

/**
 * Live USD spot prices for the header ticker, from CoinGecko's keyless simple-price API
 * (https://docs.coingecko.com/reference/simple-price). Tatum's rate API has no DEEP
 * price, so the ticker can't use it. The free tier allows ~30 calls/min, so every
 * viewer shares one cached snapshot per server.
 */

export const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price";

const DEFAULT_TTL_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 5_000;

export interface SpotPrices {
  /** Cached snapshot; falls back to the last good one when a refresh fails. */
  get(): Promise<SpotSnapshot>;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const quoteSchema = z.object({
  usd: z.number().positive().finite().optional(),
  usd_24h_change: z.number().finite().nullable().optional(),
});
const bodySchema = z.record(z.string(), z.unknown());

function parseSnapshot(body: unknown, fetchedAt: number): SpotSnapshot {
  const quotes = bodySchema.parse(body);
  const prices = SPOT_TOKENS.map(({ symbol, coingeckoId }) => {
    const quote = quoteSchema.safeParse(quotes[coingeckoId]);
    const usd = quote.success ? (quote.data.usd ?? null) : null;
    const change24h = quote.success && usd !== null ? (quote.data.usd_24h_change ?? null) : null;
    return { symbol, usd, change24h };
  });
  return { prices, fetchedAt };
}

export function createSpotPrices({
  fetch: fetchFn = fetch,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
}: { fetch?: FetchFn; now?: () => number; ttlMs?: number } = {}): SpotPrices {
  let cached: SpotSnapshot | null = null;
  let inFlight: Promise<SpotSnapshot> | null = null;

  async function refresh(): Promise<SpotSnapshot> {
    const params = new URLSearchParams({
      ids: SPOT_TOKENS.map((token) => token.coingeckoId).join(","),
      vs_currencies: "usd",
      include_24hr_change: "true",
    });
    const response = await fetchFn(`${COINGECKO_URL}?${params}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`CoinGecko responded ${response.status}`);
    return parseSnapshot(await response.json(), now());
  }

  return {
    async get() {
      if (cached && now() - cached.fetchedAt < ttlMs) return cached;
      inFlight ??= refresh()
        .then((snapshot) => (cached = snapshot))
        .finally(() => (inFlight = null));
      try {
        return await inFlight;
      } catch (error: unknown) {
        if (cached) return cached;
        throw error;
      }
    },
  };
}

/** Process-wide instance so every request shares one upstream call per TTL. */
export const spotPrices = createSpotPrices();
