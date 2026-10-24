import { describe, expect, test } from "vitest";
import { loadActivities, loadTwinSnapshot, storeActivities } from "@/lib/twin/data";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const ADDRESS = `0x${"9".repeat(64)}`;
const T0 = 1_790_000_000_000;

describe("storeActivities", () => {
  test("stores only new digests and round-trips activity data", async () => {
    const buy = swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null));
    const sell = swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(SUI, 150, 150));

    const first = await storeActivities(ADDRESS, [buy]);
    const second = await storeActivities(ADDRESS, [buy, sell]);

    expect(first.map((a) => a.digest)).toEqual([buy.digest]);
    expect(second.map((a) => a.digest)).toEqual([sell.digest]);
    expect(await loadActivities(ADDRESS)).toEqual([buy, sell]);

    const snapshot = await loadTwinSnapshot(ADDRESS);
    expect(snapshot.stats.realizedPnlUsd).toBe(50);
    expect(snapshot.features.distinctTokens).toBe(2);
  });
});
