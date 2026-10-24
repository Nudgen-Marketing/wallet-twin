import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ValuedActivity } from "@/lib/trades/types";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const LEADER = `0x${"3".repeat(64)}`;
const FOLLOWER = `0x${"2".repeat(64)}`;
const T0 = Date.parse("2026-10-24T10:00:00Z");

// Leader activity that "Tatum" reports, keyed by checkpoint (tests push into it).
const chain: ValuedActivity[] = [];

vi.mock("@/lib/tatum", () => ({
  getHistoryRange: async () => ({ firstCheckpoint: 1, firstTimestampMs: 0, lastCheckpoint: 100, lastTimestampMs: T0 }),
  getBalances: async () => new Map([[SUI, 400_000_000_000n]]), // 400 SUI
  getAddressHistory: async (_address: string, options: { afterCheckpoint?: number }) => ({
    transactions: chain
      .filter((activity) => activity.checkpoint > (options.afterCheckpoint ?? 0))
      .map((activity) => ({ digest: activity.digest, checkpoint: activity.checkpoint })),
    hitCap: false,
    pages: 1,
  }),
}));
vi.mock("@/lib/trades/analyze", () => ({
  analyzeTransactions: async (_address: string, transactions: { digest: string }[]) => ({
    activities: chain.filter((activity) => transactions.some((tx) => tx.digest === activity.digest)),
    pricesFetched: 0,
    pricesSkipped: 0,
  }),
}));
vi.mock("@/lib/trades/coins", () => ({
  getCoinMetas: async () => new Map([[SUI, { symbol: "SUI", decimals: 9 }]]),
}));

const { db } = await import("@/lib/db");
const { CopyError, followLeader, pollFollows, unfollowLeader } = await import("@/lib/copy/service");
const { loadPortfolio } = await import("@/lib/copy/portfolio");

function onChain(activity: ValuedActivity, checkpoint: number): ValuedActivity {
  const placed = { ...activity, checkpoint };
  chain.push(placed);
  return placed;
}

beforeEach(async () => {
  chain.length = 0;
  await db.paperTrade.deleteMany({});
  await db.follow.deleteMany({});
  await db.publicTwin.upsert({ where: { address: LEADER }, create: { address: LEADER }, update: {} });
});

describe("following", () => {
  test("only published twins, never yourself", async () => {
    await expect(followLeader(LEADER, LEADER)).rejects.toBeInstanceOf(CopyError);
    await expect(followLeader(FOLLOWER, `0x${"8".repeat(64)}`)).rejects.toMatchObject({ status: 404 });
  });

  test("starts a $1,000 paper portfolio from the chain tip with the leader's real balances", async () => {
    await followLeader(FOLLOWER, LEADER);

    const follow = await db.follow.findUniqueOrThrow({ where: { follower_leader: { follower: FOLLOWER, leader: LEADER } } });
    expect(follow).toMatchObject({ active: true, startingUsd: 1000, lastCheckpoint: 100 });
    expect(JSON.parse(follow.leaderBalances)).toEqual({ [SUI]: 400 });
  });
});

describe("pollFollows", () => {
  test("copies new leader swaps proportionally, once, and reports leader fee earnings", async () => {
    onChain(swap(T0 - 1000, leg(SUI, 50, 100), leg(MEME, 500, null)), 90); // before following: ignored
    await followLeader(FOLLOWER, LEADER);
    onChain({ ...swap(T0, leg(SUI, 100, 200), leg(MEME, 1000, null)), gasMist: "0" }, 101); // 25% of 400 SUI

    const first = await pollFollows(FOLLOWER);
    const second = await pollFollows(FOLLOWER);

    expect(first).toMatchObject({ follows: 1, newTrades: 1, filled: 1, skipped: 0 });
    expect(second).toMatchObject({ newTrades: 0 });
    const [view] = await loadPortfolio(FOLLOWER);
    expect(view.filled).toBe(1);
    expect(view.copiedVolumeUsd).toBeCloseTo(250);
    expect(view.feesUsd).toBeCloseTo(1.25);
    expect(view.leaderEarnedUsd).toBeCloseTo(0.625);
    expect(view.cashUsd).toBeCloseTo(750);
    expect(view.holdings[0]).toMatchObject({ symbol: "MEME" });
    expect(view.recentTrades[0].summary).toMatch(/^Bought .* MEME with paper cash$/);
  });

  test("pauses copying while the leader is unpublished", async () => {
    await followLeader(FOLLOWER, LEADER);
    onChain(swap(T0, leg(SUI, 100, 200), leg(MEME, 1000, null)), 101);
    await db.publicTwin.delete({ where: { address: LEADER } });

    expect(await pollFollows(FOLLOWER)).toMatchObject({ pausedLeaders: 1, newTrades: 0 });
    expect((await loadPortfolio(FOLLOWER))[0].leaderIsPublic).toBe(false);
  });

  test("unfollowing removes the portfolio from view", async () => {
    await followLeader(FOLLOWER, LEADER);
    await unfollowLeader(FOLLOWER, LEADER);

    expect(await loadPortfolio(FOLLOWER)).toEqual([]);
  });
});
