import { describe, expect, test } from "vitest";
import { computeStats } from "@/lib/trades/stats";
import type { ValuedActivity } from "@/lib/trades/types";
import { leg, MEME, SUI, swap, USDC } from "@/tests/support/sui";

const HOUR = 3_600_000;
const T0 = 1_790_000_000_000;

describe("computeStats", () => {
  test("FIFO realized PnL, win rate and holding time for a buy then sell", () => {
    const activities = [
      swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)), // buy 1000 MEME for $100
      swap(T0 + 10 * HOUR, leg(MEME, 1000, null), leg(SUI, 150, 150)), // sell for $150
    ];

    const stats = computeStats(activities);

    expect(stats).toMatchObject({
      swapCount: 2,
      pricedSwapCount: 2,
      tradedVolumeUsd: 250,
      closedTrades: 1,
      wins: 1,
      winRate: 1,
      realizedPnlUsd: 50,
      avgHoldingMs: 10 * HOUR,
    });
    expect(stats.biggestWin).toMatchObject({ symbol: "MEME", pnlUsd: 50 });
    expect(stats.worstLoss).toBeNull();
  });

  test("partial sells consume the oldest lots first", () => {
    const activities = [
      swap(T0, leg(SUI, 10, 10), leg(MEME, 100, null)), // $0.10/unit
      swap(T0 + HOUR, leg(SUI, 30, 30), leg(MEME, 100, null)), // $0.30/unit
      swap(T0 + 2 * HOUR, leg(MEME, 150, null), leg(SUI, 30, 30)), // sell 150 @ $0.20
    ];

    const stats = computeStats(activities);

    // Cost = 100*0.10 + 50*0.30 = 25; proceeds 30 → +5.
    expect(stats.realizedPnlUsd).toBeCloseTo(5);
    expect(stats.closedTrades).toBe(1);
  });

  test("selling a token bought before the history window is unmatched, not a guess", () => {
    const stats = computeStats([swap(T0, leg(MEME, 1000, null), leg(SUI, 150, 150))]);

    expect(stats).toMatchObject({ closedTrades: 0, winRate: null, realizedPnlUsd: 0, swapCount: 1 });
  });

  test("tokens received by transfer have no cost basis", () => {
    const gift: ValuedActivity = {
      ...swap(T0, leg(SUI, 0, 0), leg(MEME, 1000, null)),
      kind: "transfer_in",
      legsOut: [],
      usdValue: null,
    };
    const stats = computeStats([gift, swap(T0 + HOUR, leg(MEME, 1000, null), leg(SUI, 10, 10))]);

    expect(stats.closedTrades).toBe(0);
  });

  test("stablecoin legs never count as wins or losses", () => {
    const activities = [
      swap(T0, leg(SUI, 100, 100), leg(USDC, 100, 100)),
      swap(T0 + HOUR, leg(USDC, 100, 100.2), leg(SUI, 99, 100.2)),
    ];

    expect(computeStats(activities).closedTrades).toBe(0);
  });

  test("losses are tracked and win rate counts only winners", () => {
    const activities = [
      swap(T0, leg(SUI, 100, 100), leg(MEME, 100, null)),
      swap(T0 + HOUR, leg(MEME, 50, null), leg(SUI, 80, 80)), // cost 50 → +30
      swap(T0 + 2 * HOUR, leg(MEME, 50, null), leg(SUI, 20, 20)), // cost 50 → −30
    ];

    const stats = computeStats(activities);

    expect(stats).toMatchObject({ closedTrades: 2, wins: 1, winRate: 0.5 });
    expect(stats.realizedPnlUsd).toBeCloseTo(0);
    expect(stats.worstLoss?.pnlUsd).toBeCloseTo(-30);
  });

  test("unpriced swaps count as trades but not volume", () => {
    const stats = computeStats([swap(T0, leg(MEME, 1, null), leg(`0x${"f".repeat(64)}::x::X`, 1, null))]);

    expect(stats).toMatchObject({ swapCount: 1, pricedSwapCount: 0, tradedVolumeUsd: 0 });
  });

  test("favourite tokens by number of swaps, first/last activity", () => {
    const stats = computeStats([
      swap(T0, leg(SUI, 1, 1), leg(MEME, 1, null)),
      swap(T0 + HOUR, leg(MEME, 1, null), leg(SUI, 1, 1)),
      swap(T0 + 2 * HOUR, leg(SUI, 1, 1), leg(USDC, 1, 1)),
    ]);

    expect(stats.favoriteTokens.map((token) => token.symbol)).toEqual(["SUI", "MEME", "USDC"]);
    expect(stats).toMatchObject({ firstActivityMs: T0, lastActivityMs: T0 + 2 * HOUR });
  });

  test("empty history", () => {
    expect(computeStats([])).toMatchObject({ swapCount: 0, winRate: null, avgHoldingMs: null, firstActivityMs: null });
  });
});
