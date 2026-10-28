/** Shared by the price route and the header ticker; kept free of server code so the client bundle stays small. */

export const SPOT_TOKENS = [
  { symbol: "SUI", coingeckoId: "sui" },
  { symbol: "DEEP", coingeckoId: "deep" },
  { symbol: "WAL", coingeckoId: "walrus-2" },
] as const;

export interface SpotPrice {
  symbol: string;
  /** Null when upstream has no usable price for this token right now. */
  usd: number | null;
  /** 24h change in percent, or null when unknown. */
  change24h: number | null;
}

export interface SpotSnapshot {
  prices: SpotPrice[];
  fetchedAt: number;
}
