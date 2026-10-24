import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { rememberTwin } from "@/lib/memory";
import { storeActivities } from "@/lib/twin/data";
import { loadPublicTwin } from "@/lib/twin/public";
import {
  firstSentence,
  getLeaderboard,
  isPublished,
  publishTwin,
  rankLeaderboard,
  stripAsOf,
  unpublishTwin,
} from "@/lib/twin/publish";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const ADDRESS = `0x${"4".repeat(64)}`;
const T0 = Date.parse("2026-10-01T10:00:00Z");

describe("publish lifecycle", () => {
  test("twins are private by default, public after opt-in, gone after unpublish", async () => {
    await storeActivities(ADDRESS, [
      swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)),
      swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(SUI, 120, 120)),
    ]);
    await rememberTwin(ADDRESS, [
      { type: "profile", key: "profile:p1", text: "(as of 2026-10-24) This wallet flips MEME fast. It rarely holds." },
      { type: "insight", key: "insight:p1:0", text: "(as of 2026-10-24) Sells within an hour." },
      { type: "milestone", key: "milestone:x", text: "First swap on record (2026-10-01)." },
      { type: "chat", key: "chat:private", text: 'Owner said: "My password hint is tea."' },
    ]);

    expect(await isPublished(ADDRESS)).toBe(false);
    expect(await loadPublicTwin(ADDRESS)).toBeNull();

    await publishTwin(ADDRESS);

    const view = await loadPublicTwin(ADDRESS);
    expect(view).toMatchObject({
      profile: "This wallet flips MEME fast. It rarely holds.",
      insights: ["Sells within an hour."],
      milestones: ["First swap on record (2026-10-01)."],
    });
    expect(JSON.stringify(view)).not.toContain("password");
    const board = await getLeaderboard();
    expect(board.find((row) => row.address === ADDRESS)).toMatchObject({
      swaps: 2,
      realizedPnlUsd: 20,
      favoriteToken: "MEME",
      headline: "This wallet flips MEME fast.",
    });

    await unpublishTwin(ADDRESS);

    expect(await loadPublicTwin(ADDRESS)).toBeNull();
    expect((await getLeaderboard()).some((row) => row.address === ADDRESS)).toBe(false);
    expect(await db.leaderboardEntry.count({ where: { address: ADDRESS } })).toBe(0);
  });
});

describe("rankLeaderboard", () => {
  const base = { swaps: 10, volumeUsd: 0, favoriteToken: null, headline: null };

  test("copy return first, then win rate, then PnL; thin records rank last", () => {
    const ranked = rankLeaderboard([
      { ...base, address: "0xa", closedTrades: 10, winRate: 0.9, realizedPnlUsd: 5, copyReturnPct: 2 },
      { ...base, address: "0xb", closedTrades: 10, winRate: 0.4, realizedPnlUsd: 900, copyReturnPct: 12 },
      { ...base, address: "0xc", closedTrades: 1, winRate: 1, realizedPnlUsd: 9_999, copyReturnPct: 50 },
      { ...base, address: "0xd", closedTrades: 10, winRate: 0.9, realizedPnlUsd: 50, copyReturnPct: 2 },
    ]);

    expect(ranked.map((row) => [row.rank, row.address])).toEqual([
      [1, "0xb"],
      [2, "0xd"],
      [3, "0xa"],
      [4, "0xc"],
    ]);
  });
});

describe("text helpers", () => {
  test("strip the type prefix and as-of stamp, cut to the first sentence", () => {
    expect(stripAsOf("[profile] (as of 2026-10-24) Hello there.")).toBe("Hello there.");
    expect(firstSentence("One. Two.")).toBe("One.");
    expect(firstSentence("x".repeat(200), 10)).toBe("xxxxxxxxx…");
  });
});
