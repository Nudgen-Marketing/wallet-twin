import { describe, expect, test, vi } from "vitest";

// The copy backtest reads live balances from Tatum; tests stub that boundary.
vi.mock("@/lib/copy/service", () => ({ backtestCopyReturnPct: async () => 4 }));

// Syncing calls Tatum; stand in with a run that stores two swaps, or fails for FAILING.
const FAILING = new Set<string>();
const runSync = vi.fn(async (runId: string, address: string) => {
  if (FAILING.has(address)) {
    await db.syncRun.update({ where: { id: runId }, data: { status: "failed", error: "Tatum unavailable" } });
    return;
  }
  await storeActivities(address, [
    swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)),
    swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(SUI, 130, 130)),
  ]);
  await db.syncRun.update({ where: { id: runId }, data: { status: "done", stage: "done" } });
});
vi.mock("@/lib/sync/run", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync/run")>()),
  runSync: (runId: string, address: string) => runSync(runId, address),
}));

import { db } from "@/lib/db";
import { demoWallets } from "@/lib/demo";
import { seedDemoTwins } from "@/lib/demo-seed";
import { storeActivities } from "@/lib/twin/data";
import { getLeaderboard } from "@/lib/twin/publish";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const T0 = Date.parse("2026-10-02T10:00:00Z");

describe("seedDemoTwins", () => {
  test("syncs and publishes missing demo twins, then skips them once seeded", async () => {
    const wallets = demoWallets();
    const saver = wallets[wallets.length - 1];
    const others = wallets.filter((wallet) => wallet !== saver);
    FAILING.add(saver.address);

    const first = await seedDemoTwins({ onlyMissing: true });

    expect(first).toEqual(
      wallets.map((wallet) =>
        wallet === saver
          ? expect.objectContaining({ address: saver.address, outcome: "failed", detail: "Tatum unavailable" })
          : expect.objectContaining({ address: wallet.address, outcome: "seeded" }),
      ),
    );
    const board = await getLeaderboard();
    for (const wallet of others) expect(board.map((row) => row.address)).toContain(wallet.address);
    expect(board.map((row) => row.address)).not.toContain(saver.address);

    FAILING.clear();
    runSync.mockClear();
    const second = await seedDemoTwins({ onlyMissing: true });

    expect(second.map((result) => result.outcome)).toEqual(wallets.map((wallet) => (wallet === saver ? "seeded" : "skipped")));
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(runSync).toHaveBeenCalledWith(expect.any(String), saver.address);
  });

  test("re-syncs seeded twins when asked to refresh all of them", async () => {
    runSync.mockClear();

    const results = await seedDemoTwins({ onlyMissing: false });

    expect(results.map((result) => result.outcome)).toEqual(demoWallets().map(() => "seeded"));
    expect(runSync).toHaveBeenCalledTimes(demoWallets().length);
  });
});
