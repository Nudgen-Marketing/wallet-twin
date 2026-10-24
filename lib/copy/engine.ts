/**
 * Paper copy-trading engine. SIMULATED ONLY: nothing here touches a real wallet.
 *
 * Proportional rule: when the leader swaps away X% of their balance of a coin, the
 * follower swaps away X% of their own paper position in it (or X% of paper cash when
 * the coin is a quote asset: SUI, USDC, USDT). Fills use the leader trade's own USD
 * value at that moment. A 0.5% platform fee on copied volume is split 50/50 between
 * the platform and the leader.
 */

export const STARTING_USD = 1_000;
export const FEE_RATE = 0.005;
export const LEADER_FEE_SHARE = 0.5;
const MIN_COPY_USD = 0.01;

/** Quote assets map to the follower's USD cash (the follower takes no SUI price exposure). */
export const QUOTE_COINS: ReadonlySet<string> = new Set([
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
]);

export interface PaperState {
  cashUsd: number;
  /** coinType → units held. */
  positions: Readonly<Record<string, number>>;
  /** coinType → last seen USD unit price (from the leader's trades). */
  lastPriceUsd: Readonly<Record<string, number>>;
  symbols: Readonly<Record<string, string>>;
  copiedVolumeUsd: number;
  feesUsd: number;
  filled: number;
  skipped: number;
}

export interface LeaderSwap {
  digest: string;
  timestampMs: number;
  sold: { coinType: string; symbol: string | null; amount: number | null };
  bought: { coinType: string; symbol: string | null; amount: number | null };
  /** USD value of the leader's trade, or null when unknown. */
  usdValue: number | null;
  /** Leader's balance of the sold coin just before the trade (units), if known. */
  leaderBalanceBefore: number | null;
}

export type Fill =
  | {
      status: "filled";
      volumeUsd: number;
      feeUsd: number;
      soldCoin: string;
      soldAmount: number;
      boughtCoin: string;
      boughtAmount: number;
    }
  | { status: "skipped"; reason: string };

export function initialPaperState(startingUsd: number = STARTING_USD): PaperState {
  return {
    cashUsd: startingUsd,
    positions: {},
    lastPriceUsd: {},
    symbols: {},
    copiedVolumeUsd: 0,
    feesUsd: 0,
    filled: 0,
    skipped: 0,
  };
}

const skip = (state: PaperState, reason: string): { state: PaperState; fill: Fill } => ({
  state: { ...state, skipped: state.skipped + 1 },
  fill: { status: "skipped", reason },
});

export function applyLeaderSwap(state: PaperState, swap: LeaderSwap): { state: PaperState; fill: Fill } {
  const { sold, bought, usdValue } = swap;
  if (usdValue === null || usdValue <= 0 || !sold.amount || !bought.amount) {
    return skip(state, "No reliable USD price for this trade");
  }

  const soldPrice = usdValue / sold.amount;
  const boughtPrice = usdValue / bought.amount;
  const priced: PaperState = {
    ...state,
    lastPriceUsd: { ...state.lastPriceUsd, [sold.coinType]: soldPrice, [bought.coinType]: boughtPrice },
    symbols: {
      ...state.symbols,
      ...(sold.symbol ? { [sold.coinType]: sold.symbol } : {}),
      ...(bought.symbol ? { [bought.coinType]: bought.symbol } : {}),
    },
  };

  const soldIsCash = QUOTE_COINS.has(sold.coinType);
  const boughtIsCash = QUOTE_COINS.has(bought.coinType);
  if (soldIsCash && boughtIsCash) return skip(priced, "Swap between cash-like assets (SUI/stables)");
  if (!swap.leaderBalanceBefore || swap.leaderBalanceBefore <= 0) {
    return skip(priced, "Leader's prior balance unknown, so the trade size can't be mirrored");
  }

  const fraction = Math.min(1, sold.amount / swap.leaderBalanceBefore);
  const heldUnits = priced.positions[sold.coinType] ?? 0;
  const soldUnits = soldIsCash ? 0 : heldUnits * fraction;
  const proceedsUsd = soldIsCash ? priced.cashUsd * fraction : soldUnits * soldPrice;
  if (proceedsUsd < MIN_COPY_USD) {
    return skip(priced, soldIsCash ? "No paper cash left to copy with" : "Follower holds none of the token the leader sold");
  }

  const feeUsd = proceedsUsd * FEE_RATE;
  const netUsd = proceedsUsd - feeUsd;
  const boughtUnits = boughtIsCash ? netUsd : netUsd / boughtPrice;

  const positions = { ...priced.positions };
  if (!soldIsCash) positions[sold.coinType] = heldUnits - soldUnits;
  if (!boughtIsCash) positions[bought.coinType] = (positions[bought.coinType] ?? 0) + boughtUnits;
  for (const [coinType, units] of Object.entries(positions)) if (units <= 1e-12) delete positions[coinType];

  return {
    state: {
      ...priced,
      cashUsd: priced.cashUsd - (soldIsCash ? proceedsUsd : 0) + (boughtIsCash ? netUsd : 0),
      positions,
      copiedVolumeUsd: priced.copiedVolumeUsd + proceedsUsd,
      feesUsd: priced.feesUsd + feeUsd,
      filled: priced.filled + 1,
    },
    fill: {
      status: "filled",
      volumeUsd: proceedsUsd,
      feeUsd,
      soldCoin: sold.coinType,
      soldAmount: soldIsCash ? proceedsUsd : soldUnits,
      boughtCoin: bought.coinType,
      boughtAmount: boughtUnits,
    },
  };
}

/** Cash plus positions marked at the last price seen in the leader's trades. */
export function portfolioValueUsd(state: PaperState): number {
  return Object.entries(state.positions).reduce(
    (total, [coinType, units]) => total + units * (state.lastPriceUsd[coinType] ?? 0),
    state.cashUsd,
  );
}

export function feeSplit(feesUsd: number): { leaderUsd: number; platformUsd: number } {
  return { leaderUsd: feesUsd * LEADER_FEE_SHARE, platformUsd: feesUsd * (1 - LEADER_FEE_SHARE) };
}
