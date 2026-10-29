import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { describeTwin, listPublishedTwins, loadTwinSeo, type TwinSeo, twinTitle } from "@/lib/seo/twin";

const PUBLISHED = `0x${"5".repeat(64)}`;
const PRIVATE = `0x${"6".repeat(64)}`;

const BASE: TwinSeo = {
  address: PUBLISHED,
  updatedAt: new Date("2026-10-28T00:00:00Z"),
  headline: null,
  swaps: null,
  winRate: null,
  realizedPnlUsd: null,
  copyReturnPct: null,
};

describe("twin SEO data", () => {
  test("only published twins have SEO data, and the sitemap lists only them", async () => {
    await db.publicTwin.create({ data: { address: PUBLISHED } });
    await db.leaderboardEntry.create({
      data: {
        address: PUBLISHED,
        swaps: 42,
        closedTrades: 10,
        winRate: 0.6,
        realizedPnlUsd: 1234.5,
        volumeUsd: 9000,
        headline: "Flips memecoins within the hour.",
      },
    });
    // A leaderboard row without a publish (e.g. after unpublishing) must stay hidden.
    await db.leaderboardEntry.create({
      data: { address: PRIVATE, swaps: 1, closedTrades: 0, realizedPnlUsd: 0, volumeUsd: 0 },
    });

    expect(await loadTwinSeo(PRIVATE)).toBeNull();
    expect(await loadTwinSeo(PUBLISHED)).toMatchObject({ swaps: 42, winRate: 0.6, headline: "Flips memecoins within the hour." });

    const listed = (await listPublishedTwins()).map((twin) => twin.address);
    expect(listed).toContain(PUBLISHED);
    expect(listed).not.toContain(PRIVATE);
  });
});

describe("describeTwin", () => {
  test("leads with the headline, then the stats", () => {
    const text = describeTwin({ ...BASE, headline: "Patient SUI swing trader.", swaps: 1200, winRate: 0.55, realizedPnlUsd: -80 });
    expect(text).toBe("Patient SUI swing trader. 1,200 swaps, 55% win rate, −$80.00 realized PnL on Sui. Chat with this wallet's AI twin.");
  });

  test("still reads well before the leaderboard row exists", () => {
    expect(describeTwin(BASE)).toBe("Trading history on Sui. Chat with this wallet's AI twin.");
  });

  test("stays within a search snippet", () => {
    const text = describeTwin({ ...BASE, headline: "word ".repeat(80), swaps: 3 });
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith("…")).toBe(true);
  });

  test("titles use the short address", () => {
    expect(twinTitle(PUBLISHED)).toMatch(/^Twin of 0x5555…5555$|^Twin of 0x5555\.\.\.5555$/);
  });
});
