import type { ActivityKind, Leg, ParsedActivity, ValuedActivity, ValuedLeg } from "@/lib/trades/types";

export interface CoinMeta {
  symbol: string | null;
  decimals: number | null;
}

/** Resolved USD unit price for a coin at a time, or null when unknown. */
export type PriceLookup = (coinType: string, atMs: number) => number | null;

/** Kinds whose USD value matters for the twin (trades), so worth spending price credits on. */
export const PRICED_KINDS: ReadonlySet<ActivityKind> = new Set(["swap", "nft_buy", "nft_sell", "nft_mint"]);

export function toUnits(raw: string, decimals: number | null): number | null {
  if (decimals === null) return null;
  return Number(BigInt(raw)) / 10 ** decimals;
}

/** Every (coin, time) pair a valuation pass would like a price for. */
export function priceRequests(activities: ParsedActivity[]): { coinType: string; atMs: number }[] {
  return activities
    .filter((activity) => PRICED_KINDS.has(activity.kind))
    .flatMap((activity) =>
      [...activity.legsOut, ...activity.legsIn].map((leg) => ({ coinType: leg.coinType, atMs: activity.timestampMs })),
    );
}

function valueLegs(legs: Leg[], atMs: number, meta: (coinType: string) => CoinMeta | undefined, price: PriceLookup): ValuedLeg[] {
  return legs.map((leg) => {
    const info = meta(leg.coinType);
    const amount = toUnits(leg.raw, info?.decimals ?? null);
    const unitPrice = price(leg.coinType, atMs);
    return {
      ...leg,
      symbol: info?.symbol ?? null,
      amount,
      usd: amount !== null && unitPrice !== null ? amount * unitPrice : null,
    };
  });
}

/** Sum of a side only when every leg on it is priced; a partial sum would understate value. */
export function sideUsd(legs: ValuedLeg[]): number | null {
  if (legs.length === 0 || legs.some((leg) => leg.usd === null)) return null;
  return legs.reduce((total, leg) => total + leg.usd!, 0);
}

export function valueActivity(
  activity: ParsedActivity,
  meta: (coinType: string) => CoinMeta | undefined,
  price: PriceLookup,
): ValuedActivity {
  const legsOut = valueLegs(activity.legsOut, activity.timestampMs, meta, price);
  const legsIn = valueLegs(activity.legsIn, activity.timestampMs, meta, price);
  // What you paid is the better measure of a trade's size; fall back to what you got.
  const usdValue = PRICED_KINDS.has(activity.kind) ? (sideUsd(legsOut) ?? sideUsd(legsIn)) : null;
  return { ...activity, legsOut, legsIn, usdValue };
}
