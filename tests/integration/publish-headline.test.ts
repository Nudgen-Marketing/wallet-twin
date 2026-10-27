import { describe, expect, test, vi } from "vitest";

// The copy backtest reads live balances from Tatum; tests stub that boundary.
vi.mock("@/lib/copy/service", () => ({ backtestCopyReturnPct: async () => 0 }));
// Walrus indexes a write minutes after it lands, so recall can still return an older profile.
vi.mock("@/lib/memory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/memory")>()),
  latestMemories: async () => [
    { text: "(as of 2026-10-20) Stale profile from an earlier sync. Old.", distance: 0, createdAt: null, namespace: "profile" },
  ],
}));
import { db } from "@/lib/db";
import { rememberTwin } from "@/lib/memory";
import { getLeaderboard, publishTwin } from "@/lib/twin/publish";

const headlineOf = async (address: string) => (await getLeaderboard()).find((row) => row.address === address)?.headline;

describe("leaderboard headline", () => {
  test("comes from the newest profile this app wrote, not a lagging recall", async () => {
    const address = `0x${"5e".repeat(32)}`;
    await rememberTwin(address, [{ type: "profile", key: "profile:old", text: "(as of 2026-10-20) Older profile. Old." }]);
    await rememberTwin(address, [{ type: "profile", key: "profile:new", text: "(as of 2026-10-27) Fresh profile. New." }]);
    await db.memoryWrite.update({
      where: { address_key: { address, key: "profile:old" } },
      data: { createdAt: new Date("2026-10-20T00:00:00Z") },
    });

    await publishTwin(address);

    expect(await headlineOf(address)).toBe("Fresh profile.");
  });

  test("ignores failed profile writes", async () => {
    const address = `0x${"6e".repeat(32)}`;
    await rememberTwin(address, [{ type: "profile", key: "profile:ok", text: "(as of 2026-10-20) Stored profile. Ok." }]);
    await rememberTwin(address, [{ type: "profile", key: "profile:bad", text: "(as of 2026-10-27) Failed profile. Bad." }]);
    await db.memoryWrite.update({ where: { address_key: { address, key: "profile:bad" } }, data: { status: "failed" } });

    await publishTwin(address);

    expect(await headlineOf(address)).toBe("Stored profile.");
  });

  test("falls back to recall when this database never wrote a profile", async () => {
    const address = `0x${"7e".repeat(32)}`;

    await publishTwin(address);

    expect(await headlineOf(address)).toBe("Stale profile from an earlier sync.");
  });
});
