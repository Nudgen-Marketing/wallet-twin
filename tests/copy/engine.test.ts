import { describe, expect, test } from "vitest";
import {
  applyLeaderSwap,
  FEE_RATE,
  feeSplit,
  initialPaperState,
  type LeaderSwap,
  portfolioValueUsd,
} from "@/lib/copy/engine";
import { backtestCopy, balanceDelta, replayForward, rewindBalances, toLeaderSwap } from "@/lib/copy/ledger";
import { leg, MEME, SUI, swap, USDC } from "@/tests/support/sui";

const T0 = Date.parse("2026-10-01T10:00:00Z");

function leaderSwap(overrides: Partial<LeaderSwap>): LeaderSwap {
  return {
    digest: "L1",
    timestampMs: T0,
    sold: { coinType: SUI, symbol: "SUI", amount: 100 },
    bought: { coinType: MEME, symbol: "MEME", amount: 1000 },
    usdValue: 200,
    leaderBalanceBefore: 400,
    ...overrides,
  };
}

describe("applyLeaderSwap", () => {
  test("a leader buying with 25% of their SUI makes the follower spend 25% of paper cash, minus the 0.5% fee", () => {
    const { state, fill } = applyLeaderSwap(initialPaperState(), leaderSwap({}));

    expect(fill).toMatchObject({ status: "filled", volumeUsd: 250, feeUsd: 250 * FEE_RATE });
    expect(state.cashUsd).toBeCloseTo(750);
    // $248.75 net at $0.20 per MEME (200 USD / 1000 MEME)
    expect(state.positions[MEME]).toBeCloseTo(1243.75);
    expect(state.copiedVolumeUsd).toBe(250);
  });

  test("a leader selling half of their token makes the follower sell half of their paper position", () => {
    const bought = applyLeaderSwap(initialPaperState(), leaderSwap({})).state;
    const { state, fill } = applyLeaderSwap(
      bought,
      leaderSwap({
        digest: "L2",
        sold: { coinType: MEME, symbol: "MEME", amount: 500 },
        bought: { coinType: SUI, symbol: "SUI", amount: 150 },
        usdValue: 150, // MEME now $0.30
        leaderBalanceBefore: 1000,
      }),
    );

    expect(fill.status).toBe("filled");
    expect(state.positions[MEME]).toBeCloseTo(1243.75 / 2);
    const proceeds = (1243.75 / 2) * 0.3;
    expect(state.cashUsd).toBeCloseTo(750 + proceeds * (1 - FEE_RATE));
    expect(state.filled).toBe(2);
  });

  test("never guesses: skips unpriced trades and unknown leader balances", () => {
    expect(applyLeaderSwap(initialPaperState(), leaderSwap({ usdValue: null })).fill).toMatchObject({
      status: "skipped",
      reason: expect.stringMatching(/price/i),
    });
    expect(applyLeaderSwap(initialPaperState(), leaderSwap({ leaderBalanceBefore: null })).fill).toMatchObject({
      status: "skipped",
      reason: expect.stringMatching(/balance/i),
    });
  });

  test("skips selling a token the follower never bought, and cash-to-cash swaps", () => {
    const sellUnheld = leaderSwap({
      sold: { coinType: MEME, symbol: "MEME", amount: 10 },
      bought: { coinType: SUI, symbol: "SUI", amount: 1 },
      leaderBalanceBefore: 10,
    });
    const cashSwap = leaderSwap({ bought: { coinType: USDC, symbol: "USDC", amount: 200 } });

    expect(applyLeaderSwap(initialPaperState(), sellUnheld).fill.status).toBe("skipped");
    const result = applyLeaderSwap(initialPaperState(), cashSwap);
    expect(result.fill).toMatchObject({ status: "skipped", reason: expect.stringMatching(/cash-like/) });
    expect(result.state.feesUsd).toBe(0);
  });

  test("is immutable", () => {
    const start = initialPaperState();
    applyLeaderSwap(start, leaderSwap({}));

    expect(start).toEqual(initialPaperState());
  });
});

describe("portfolio value and fees", () => {
  test("marks positions at the last price seen in the leader's trades", () => {
    const { state } = applyLeaderSwap(initialPaperState(), leaderSwap({}));

    expect(portfolioValueUsd(state)).toBeCloseTo(1000 - 250 * FEE_RATE);
  });

  test("fees split 50/50 between leader and platform", () => {
    expect(feeSplit(10)).toEqual({ leaderUsd: 5, platformUsd: 5 });
  });
});

describe("leader balance ledger", () => {
  const buy = swap(T0, leg(SUI, 100, 200), leg(MEME, 1000, null));
  const sell = swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(SUI, 150, 300));

  test("balance delta includes legs and gas", () => {
    expect(balanceDelta({ ...buy, gasMist: "1000000000" })).toEqual({ [SUI]: -101, [MEME]: 1000 });
  });

  test("only single-leg swaps become leader trades", () => {
    expect(toLeaderSwap(buy, { [SUI]: 400 })).toMatchObject({ leaderBalanceBefore: 400, usdValue: 200 });
    expect(toLeaderSwap({ ...buy, kind: "transfer_out" }, {})).toBeNull();
    expect(toLeaderSwap({ ...buy, legsIn: [...buy.legsIn, leg(USDC, 1, 1)] }, {})).toBeNull();
  });

  test("rewinding current balances recovers the starting balances", () => {
    const current = { [SUI]: 350, [MEME]: 0 };

    expect(rewindBalances(current, [buy, sell])).toEqual({ [SUI]: 300, [MEME]: 0 });
  });

  test("backtest: copying a round trip that doubled in value", () => {
    // Leader starts with 300 SUI: buys MEME with 100 (1/3), sells all MEME for 150 SUI.
    const run = backtestCopy([buy, sell], { [SUI]: 350, [MEME]: 0 });

    expect(run.steps.map((step) => step.fill.status)).toEqual(["filled", "filled"]);
    // Follower: $333.33 into MEME at $0.20, all sold at $0.30 → +50% on that third, minus fees.
    expect(portfolioValueUsd(run.state)).toBeGreaterThan(1150);
    expect(portfolioValueUsd(run.state)).toBeLessThan(1170);
    expect(run.state.positions[MEME]).toBeUndefined();
  });

  test("forward replay carries balances so the next sync continues where it left off", () => {
    const first = replayForward([buy], { [SUI]: 300 });
    const second = replayForward([sell], first.balances, first.state);

    expect(second.state.filled).toBe(2);
    expect(second.balances[MEME]).toBe(0);
  });
});
