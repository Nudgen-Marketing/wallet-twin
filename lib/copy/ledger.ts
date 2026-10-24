import { applyLeaderSwap, initialPaperState, type Fill, type LeaderSwap, type PaperState } from "@/lib/copy/engine";
import type { ValuedActivity } from "@/lib/trades/types";

/**
 * The leader's per-coin balances (in units), so each copied trade can be sized as a
 * fraction of what the leader held. Forward: start from a Tatum balance snapshot and
 * apply new activity. Backward: rewind current balances through stored activity.
 */
export type Balances = Readonly<Record<string, number>>;

const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

/** Net per-coin change an activity made to the leader's balances (legs + gas). */
export function balanceDelta(activity: ValuedActivity): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const leg of activity.legsIn) if (leg.amount !== null) delta[leg.coinType] = (delta[leg.coinType] ?? 0) + leg.amount;
  for (const leg of activity.legsOut) if (leg.amount !== null) delta[leg.coinType] = (delta[leg.coinType] ?? 0) - leg.amount;
  const gas = Number(activity.gasMist) / 1e9;
  if (gas) delta[SUI] = (delta[SUI] ?? 0) - gas;
  return delta;
}

export function applyDelta(balances: Balances, delta: Record<string, number>, sign: 1 | -1 = 1): Balances {
  const next = { ...balances };
  for (const [coinType, change] of Object.entries(delta)) next[coinType] = (next[coinType] ?? 0) + sign * change;
  return next;
}

/** Single-leg swaps only; multi-leg routes are skipped rather than approximated. */
export function toLeaderSwap(activity: ValuedActivity, balancesBefore: Balances): LeaderSwap | null {
  if (activity.kind !== "swap" || activity.legsOut.length !== 1 || activity.legsIn.length !== 1) return null;
  const [sold] = activity.legsOut;
  const [bought] = activity.legsIn;
  const before = balancesBefore[sold.coinType];
  return {
    digest: activity.digest,
    timestampMs: activity.timestampMs,
    sold: { coinType: sold.coinType, symbol: sold.symbol, amount: sold.amount },
    bought: { coinType: bought.coinType, symbol: bought.symbol, amount: bought.amount },
    usdValue: activity.usdValue,
    leaderBalanceBefore: before !== undefined && Number.isFinite(before) ? before : null,
  };
}

export interface CopyStep {
  digest: string;
  timestampMs: number;
  fill: Fill;
}

export interface CopyRun {
  state: PaperState;
  balances: Balances;
  steps: CopyStep[];
}

/** Replays leader activity (oldest first) against a paper portfolio, forward in time. */
export function replayForward(
  activities: ValuedActivity[],
  startBalances: Balances,
  startState: PaperState = initialPaperState(),
): CopyRun {
  let state = startState;
  let balances = startBalances;
  const steps: CopyStep[] = [];
  for (const activity of [...activities].sort((a, b) => a.timestampMs - b.timestampMs)) {
    const swap = toLeaderSwap(activity, balances);
    if (swap) {
      const result = applyLeaderSwap(state, swap);
      state = result.state;
      steps.push({ digest: activity.digest, timestampMs: activity.timestampMs, fill: result.fill });
    }
    balances = applyDelta(balances, balanceDelta(activity));
  }
  return { state, balances, steps };
}

/** Rewinds current balances through all activity to get balances at the window's start. */
export function rewindBalances(current: Balances, activities: ValuedActivity[]): Balances {
  return activities.reduce((balances, activity) => applyDelta(balances, balanceDelta(activity), -1), current);
}

/** Backtest: "what if you had followed this twin with $1,000 from the start of its history?" */
export function backtestCopy(activities: ValuedActivity[], currentBalances: Balances): CopyRun {
  return replayForward(activities, rewindBalances(currentBalances, activities));
}
