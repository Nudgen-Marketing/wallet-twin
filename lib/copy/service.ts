import "server-only";
import { db } from "@/lib/db";
import { initialPaperState, type PaperState, portfolioValueUsd, STARTING_USD } from "@/lib/copy/engine";
import { backtestCopy, type Balances, replayForward } from "@/lib/copy/ledger";
import { getAddressHistory, getBalances, getHistoryRange } from "@/lib/tatum";
import { analyzeTransactions } from "@/lib/trades/analyze";
import { getCoinMetas } from "@/lib/trades/coins";
import { toUnits } from "@/lib/trades/value";
import type { ValuedActivity } from "@/lib/trades/types";

/** Per-poll caps keep Tatum credits bounded. */
const POLL_TX_CAP = 200;
const POLL_PRICE_BUDGET = 40;
export const MAX_FOLLOWS = 5;

export class CopyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CopyError";
  }
}

/** Leader's current balances in units (Tatum GraphQL), skipping coins with unknown decimals. */
export async function leaderBalancesNow(leader: string): Promise<Balances> {
  const raw = await getBalances(leader);
  const metas = await getCoinMetas(raw.keys());
  const balances: Record<string, number> = {};
  for (const [coinType, amount] of raw) {
    const units = toUnits(amount.toString(), metas.get(coinType)?.decimals ?? null);
    if (units !== null) balances[coinType] = units;
  }
  return balances;
}

export async function followLeader(follower: string, leader: string): Promise<{ followId: string }> {
  if (follower === leader) throw new CopyError("You can't paper-copy your own twin.", 400);
  if (!(await db.publicTwin.findUnique({ where: { address: leader } }))) {
    throw new CopyError("Only published twins can be followed.", 404);
  }
  const activeCount = await db.follow.count({ where: { follower, active: true, NOT: { leader } } });
  if (activeCount >= MAX_FOLLOWS) throw new CopyError(`You can paper-copy up to ${MAX_FOLLOWS} twins at once.`, 409);

  const [range, balances] = await Promise.all([getHistoryRange(), leaderBalancesNow(leader)]);
  if (!range) throw new CopyError("Couldn't read the chain tip from Tatum. Try again shortly.", 503);

  // (Re)following starts a fresh $1,000 paper portfolio from the current chain tip.
  const data = {
    active: true,
    startingUsd: STARTING_USD,
    state: JSON.stringify(initialPaperState()),
    leaderBalances: JSON.stringify(balances),
    lastCheckpoint: range.lastCheckpoint,
    startedAt: new Date(),
    lastPolledAt: null,
  };
  const follow = await db.follow.upsert({
    where: { follower_leader: { follower, leader } },
    create: { follower, leader, ...data },
    update: data,
  });
  await db.paperTrade.deleteMany({ where: { followId: follow.id } });
  return { followId: follow.id };
}

export async function unfollowLeader(follower: string, leader: string): Promise<void> {
  await db.follow.updateMany({ where: { follower, leader }, data: { active: false } });
}

export interface PollSummary {
  follows: number;
  newTrades: number;
  filled: number;
  skipped: number;
  pausedLeaders: number;
}

/** Copies any new leader swaps (via Tatum) into each of the follower's paper portfolios. */
export async function pollFollows(follower: string): Promise<PollSummary> {
  const follows = await db.follow.findMany({ where: { follower, active: true } });
  const summary: PollSummary = { follows: follows.length, newTrades: 0, filled: 0, skipped: 0, pausedLeaders: 0 };

  for (const follow of follows) {
    if (!(await db.publicTwin.findUnique({ where: { address: follow.leader } }))) {
      summary.pausedLeaders += 1; // leader unpublished: stop copying, keep the history
      continue;
    }
    const history = await getAddressHistory(follow.leader, {
      afterCheckpoint: follow.lastCheckpoint,
      maxTransactions: POLL_TX_CAP,
    });
    if (history.transactions.length === 0) {
      await db.follow.update({ where: { id: follow.id }, data: { lastPolledAt: new Date() } });
      continue;
    }

    const { activities } = await analyzeTransactions(follow.leader, history.transactions, {
      priceBudget: POLL_PRICE_BUDGET,
    });
    const run = replayForward(
      activities,
      JSON.parse(follow.leaderBalances) as Balances,
      JSON.parse(follow.state) as PaperState,
    );
    const known = new Set(
      (await db.paperTrade.findMany({ where: { followId: follow.id }, select: { digest: true } })).map((row) => row.digest),
    );
    const fresh = run.steps.filter((step) => !known.has(step.digest));
    if (fresh.length > 0) {
      await db.paperTrade.createMany({
        data: fresh.map((step) => ({
          followId: follow.id,
          digest: step.digest,
          timestamp: new Date(step.timestampMs),
          status: step.fill.status,
          ...(step.fill.status === "filled"
            ? {
                soldCoin: step.fill.soldCoin,
                soldAmount: step.fill.soldAmount,
                boughtCoin: step.fill.boughtCoin,
                boughtAmount: step.fill.boughtAmount,
                volumeUsd: step.fill.volumeUsd,
                feeUsd: step.fill.feeUsd,
              }
            : { reason: step.fill.reason }),
        })),
      });
    }
    await db.follow.update({
      where: { id: follow.id },
      data: {
        state: JSON.stringify(run.state),
        leaderBalances: JSON.stringify(run.balances),
        lastCheckpoint: Math.max(follow.lastCheckpoint, ...history.transactions.map((tx) => tx.checkpoint)),
        lastPolledAt: new Date(),
      },
    });
    summary.newTrades += fresh.length;
    summary.filled += fresh.filter((step) => step.fill.status === "filled").length;
    summary.skipped += fresh.filter((step) => step.fill.status === "skipped").length;
  }
  return summary;
}

/**
 * Leaderboard metric: % return of a $1,000 paper copy of the twin over its synced
 * history (same engine as live following). Null when it can't be computed.
 */
export async function backtestCopyReturnPct(leader: string, activities: ValuedActivity[]): Promise<number | null> {
  if (!activities.some((activity) => activity.kind === "swap")) return null;
  try {
    const run = backtestCopy(activities, await leaderBalancesNow(leader));
    if (run.state.filled === 0) return null;
    return ((portfolioValueUsd(run.state) - STARTING_USD) / STARTING_USD) * 100;
  } catch (error: unknown) {
    console.error("[copy] backtest failed", error instanceof Error ? error.message : error);
    return null;
  }
}
