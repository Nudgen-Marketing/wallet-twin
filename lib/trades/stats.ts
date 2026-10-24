import type { ActivityKind, ValuedActivity, ValuedLeg } from "@/lib/trades/types";

/**
 * Trading stats from valued activity, using FIFO cost basis per token.
 * Every swap disposes of what went out and acquires what came in at the swap's USD value.
 * Positions opened before our history window have no cost basis, so their sales are
 * "unmatched" and excluded from win rate rather than guessed.
 */

export const STABLE_COIN_TYPES: ReadonlySet<string> = new Set([
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  "0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT",
]);

/** A sale counts as a closed trade only if at least this share of it has a known cost basis. */
const MIN_MATCHED_SHARE = 0.5;

export interface ClosedTrade {
  digest: string;
  coinType: string;
  symbol: string | null;
  timestampMs: number;
  proceedsUsd: number;
  costUsd: number;
  pnlUsd: number;
  holdingMs: number;
}

export interface TokenUsage {
  coinType: string;
  symbol: string | null;
  trades: number;
}

export interface TwinStats {
  activityCounts: Partial<Record<ActivityKind, number>>;
  swapCount: number;
  pricedSwapCount: number;
  tradedVolumeUsd: number;
  closedTrades: number;
  wins: number;
  /** 0–1, or null when nothing closed with a known cost basis. */
  winRate: number | null;
  realizedPnlUsd: number;
  /** Average time sold positions were held, weighted by their USD cost. */
  avgHoldingMs: number | null;
  favoriteTokens: TokenUsage[];
  biggestWin: ClosedTrade | null;
  worstLoss: ClosedTrade | null;
  firstActivityMs: number | null;
  lastActivityMs: number | null;
  nftCount: number;
}

interface Lot {
  quantity: number;
  unitCostUsd: number | null;
  acquiredMs: number;
}

/** USD value attributed to each leg of a side: own price, or the whole side value for a single leg. */
function attributedUsd(legs: ValuedLeg[], sideValue: number | null): (number | null)[] {
  if (legs.length === 1) return [legs[0].usd ?? sideValue];
  return legs.map((leg) => leg.usd);
}

export function computeStats(activities: ValuedActivity[]): TwinStats {
  const ordered = [...activities].sort((a, b) => a.timestampMs - b.timestampMs);
  const lots = new Map<string, Lot[]>();
  const closed: ClosedTrade[] = [];
  const usage = new Map<string, TokenUsage>();
  const activityCounts: Partial<Record<ActivityKind, number>> = {};
  let swapCount = 0;
  let pricedSwapCount = 0;
  let tradedVolumeUsd = 0;
  let nftCount = 0;

  const addLot = (coinType: string, lot: Lot) => {
    if (lot.quantity <= 0) return;
    lots.set(coinType, [...(lots.get(coinType) ?? []), lot]);
  };

  /** Consumes FIFO lots; returns matched cost/holding for the portion with known cost. */
  const consume = (coinType: string, quantity: number, atMs: number) => {
    const queue = [...(lots.get(coinType) ?? [])];
    let remaining = quantity;
    let knownQty = 0;
    let knownCost = 0;
    let weightedHold = 0;
    while (remaining > 0 && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(remaining, lot.quantity);
      if (lot.unitCostUsd !== null) {
        knownQty += take;
        knownCost += take * lot.unitCostUsd;
        weightedHold += take * (atMs - lot.acquiredMs);
      }
      remaining -= take;
      if (take >= lot.quantity) queue.shift();
      else queue[0] = { ...lot, quantity: lot.quantity - take };
    }
    lots.set(coinType, queue);
    return { knownQty, knownCost, weightedHold };
  };

  for (const activity of ordered) {
    activityCounts[activity.kind] = (activityCounts[activity.kind] ?? 0) + 1;
    if (activity.kind.startsWith("nft_")) nftCount += activity.nftTypes.length || 1;

    if (activity.kind === "transfer_in") {
      for (const leg of activity.legsIn) {
        if (leg.amount !== null) addLot(leg.coinType, { quantity: leg.amount, unitCostUsd: null, acquiredMs: activity.timestampMs });
      }
      continue;
    }
    if (activity.kind === "transfer_out") {
      for (const leg of activity.legsOut) if (leg.amount !== null) consume(leg.coinType, leg.amount, activity.timestampMs);
      continue;
    }
    if (activity.kind !== "swap") continue;

    swapCount += 1;
    const value = activity.usdValue;
    if (value !== null) {
      pricedSwapCount += 1;
      tradedVolumeUsd += value;
    }
    for (const leg of [...activity.legsOut, ...activity.legsIn]) {
      const current = usage.get(leg.coinType) ?? { coinType: leg.coinType, symbol: leg.symbol, trades: 0 };
      usage.set(leg.coinType, { ...current, symbol: current.symbol ?? leg.symbol, trades: current.trades + 1 });
    }

    const proceeds = attributedUsd(activity.legsOut, value);
    activity.legsOut.forEach((leg, index) => {
      if (leg.amount === null || leg.amount <= 0) return;
      const { knownQty, knownCost, weightedHold } = consume(leg.coinType, leg.amount, activity.timestampMs);
      const legProceeds = proceeds[index];
      if (STABLE_COIN_TYPES.has(leg.coinType) || legProceeds === null) return;
      if (knownQty / leg.amount < MIN_MATCHED_SHARE) return;
      const matchedProceeds = legProceeds * (knownQty / leg.amount);
      closed.push({
        digest: activity.digest,
        coinType: leg.coinType,
        symbol: leg.symbol,
        timestampMs: activity.timestampMs,
        proceedsUsd: matchedProceeds,
        costUsd: knownCost,
        pnlUsd: matchedProceeds - knownCost,
        holdingMs: weightedHold / knownQty,
      });
    });

    const costs = attributedUsd(activity.legsIn, value);
    activity.legsIn.forEach((leg, index) => {
      if (leg.amount === null || leg.amount <= 0) return;
      const cost = costs[index];
      addLot(leg.coinType, {
        quantity: leg.amount,
        unitCostUsd: cost === null ? null : cost / leg.amount,
        acquiredMs: activity.timestampMs,
      });
    });
  }

  const wins = closed.filter((trade) => trade.pnlUsd > 0).length;
  const heldWeight = closed.reduce((total, trade) => total + trade.costUsd, 0);
  const byPnl = [...closed].sort((a, b) => b.pnlUsd - a.pnlUsd);

  return {
    activityCounts,
    swapCount,
    pricedSwapCount,
    tradedVolumeUsd,
    closedTrades: closed.length,
    wins,
    winRate: closed.length > 0 ? wins / closed.length : null,
    realizedPnlUsd: closed.reduce((total, trade) => total + trade.pnlUsd, 0),
    avgHoldingMs:
      closed.length > 0 && heldWeight > 0
        ? closed.reduce((total, trade) => total + trade.holdingMs * trade.costUsd, 0) / heldWeight
        : null,
    favoriteTokens: [...usage.values()].sort((a, b) => b.trades - a.trades).slice(0, 5),
    biggestWin: byPnl[0] && byPnl[0].pnlUsd > 0 ? byPnl[0] : null,
    worstLoss: byPnl.at(-1) && byPnl.at(-1)!.pnlUsd < 0 ? byPnl.at(-1)! : null,
    firstActivityMs: ordered[0]?.timestampMs ?? null,
    lastActivityMs: ordered.at(-1)?.timestampMs ?? null,
    nftCount,
  };
}
