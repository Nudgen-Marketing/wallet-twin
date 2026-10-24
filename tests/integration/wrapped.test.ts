import { describe, expect, test } from "vitest";
import { db } from "@/lib/db";
import { storeActivities } from "@/lib/twin/data";
import { buildWrappedCard, fallbackLine, wrappedShareText } from "@/lib/wrapped/data";
import { isValidWrappedToken, wrappedImagePath, wrappedSharePath, wrappedToken } from "@/lib/wrapped/share";
import { computeStats } from "@/lib/trades/stats";
import { computeFeatures } from "@/lib/twin/features";
import { leg, MEME, SUI, swap, USDC } from "@/tests/support/sui";

const ADDRESS = `0x${"5".repeat(64)}`;
const OTHER = `0x${"6".repeat(64)}`;
const T0 = Date.parse("2026-10-01T10:00:00Z");

describe("Wrapped share tokens", () => {
  test("are stable per wallet and bound to it", () => {
    expect(wrappedToken(ADDRESS)).toBe(wrappedToken(ADDRESS));
    expect(wrappedToken(ADDRESS)).not.toBe(wrappedToken(OTHER));
    expect(isValidWrappedToken(ADDRESS, wrappedToken(ADDRESS))).toBe(true);
    expect(isValidWrappedToken(OTHER, wrappedToken(ADDRESS))).toBe(false);
    expect(isValidWrappedToken(ADDRESS, null)).toBe(false);
    expect(isValidWrappedToken(ADDRESS, "short")).toBe(false);
  });

  test("links carry the token", () => {
    expect(wrappedImagePath(ADDRESS)).toBe(`/api/wrapped/og?a=${ADDRESS}&t=${wrappedToken(ADDRESS)}`);
    expect(wrappedSharePath(ADDRESS)).toBe(`/w/${ADDRESS}?t=${wrappedToken(ADDRESS)}`);
  });
});

describe("buildWrappedCard", () => {
  test("summarizes stats, prefers a traded token over stables/SUI, and caches the line", async () => {
    await storeActivities(ADDRESS, [
      swap(T0, leg(USDC, 100, 100), leg(MEME, 1000, null)),
      swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(USDC, 130, 130)),
      swap(T0 + 7_200_000, leg(SUI, 10, 10), leg(USDC, 10, 10)),
    ]);

    const card = await buildWrappedCard(ADDRESS);

    expect(card).toMatchObject({ swaps: 3, winRate: 1, realizedPnlUsd: 30, favoriteToken: "MEME" });
    expect(card.biggestWin).toEqual({ symbol: "MEME", pnlUsd: 30 });
    expect(await db.wrappedLine.findUnique({ where: { address: ADDRESS } })).toMatchObject({ line: card.line });
    expect(wrappedShareText(card)).toContain("3 swaps · 100% win rate · +$30.00 realized");
  });
});

describe("fallbackLine", () => {
  test("has a line for an empty wallet and for a winner", () => {
    const empty = computeStats([]);
    expect(fallbackLine(empty, computeFeatures([], empty))).toMatch(/few words/);
  });
});
