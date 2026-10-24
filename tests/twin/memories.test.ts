import { describe, expect, test } from "vitest";
import { formatMemory, memoryTypeOf, memoryTypesFor, namespaceFor } from "@/lib/memory/namespaces";
import { computeStats } from "@/lib/trades/stats";
import { milestoneMemories, tradeMemories } from "@/lib/twin/memories";
import { fallbackNarrative, factSheet } from "@/lib/twin/narrative";
import { computeFeatures } from "@/lib/twin/features";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const T0 = Date.parse("2026-10-01T10:00:00Z");
const ACTIVITIES = [
  swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)),
  swap(T0 + 6 * 3_600_000, leg(MEME, 1000, null), leg(SUI, 150, 150)),
];

describe("namespaces", () => {
  test("one namespace per wallet and type, lower-cased", () => {
    expect(namespaceFor("0xABC", "trade")).toBe("twin:0xabc:trade");
  });

  test("public audiences only see profile, insight and milestone", () => {
    expect(memoryTypesFor("public")).toEqual(["profile", "insight", "milestone"]);
    expect(memoryTypesFor("owner")).toContain("chat");
  });

  test("type prefixes round-trip", () => {
    expect(formatMemory("insight", "  Holds < 48h ")).toBe("[insight] Holds < 48h");
    expect(memoryTypeOf("[milestone] First NFT")).toBe("milestone");
    expect(memoryTypeOf("[unknown] x")).toBeNull();
  });
});

describe("tradeMemories", () => {
  test("one keyed entry per memorable activity, newest first, with the outcome", () => {
    const stats = computeStats(ACTIVITIES);

    const entries = tradeMemories(ACTIVITIES, stats);

    expect(entries.map((entry) => entry.key)).toEqual([`trade:${ACTIVITIES[1].digest}`, `trade:${ACTIVITIES[0].digest}`]);
    expect(entries[0].text).toContain("swapped 1,000 MEME for 150 SUI (≈$150) via router::swap");
    expect(entries[0].text).toContain("Outcome: closed MEME at +$50.00 after holding 6.0 h");
    expect(entries[1].text).not.toContain("Outcome");
  });
});

describe("milestoneMemories", () => {
  test("records firsts and records with digest-stable keys", () => {
    const entries = milestoneMemories(ACTIVITIES, computeStats(ACTIVITIES));
    const keys = entries.map((entry) => entry.key);

    expect(keys).toContain(`milestone:first-swap:${ACTIVITIES[0].digest}`);
    expect(keys).toContain(`milestone:biggest-win:${ACTIVITIES[1].digest}`);
    expect(entries.find((entry) => entry.key.startsWith("milestone:biggest-win"))?.text).toBe(
      "Biggest win: +$50.00 on MEME (closed 2026-10-01, held 6.0 h).",
    );
    expect(milestoneMemories(ACTIVITIES, computeStats(ACTIVITIES))).toEqual(entries);
  });
});

describe("narrative grounding", () => {
  test("the fact sheet carries the computed numbers", () => {
    const stats = computeStats(ACTIVITIES);
    const sheet = factSheet(stats, computeFeatures(ACTIVITIES, stats));

    expect(sheet).toContain("win rate 100%");
    expect(sheet).toContain("realized PnL estimate +$50.00");
  });

  test("template narrative works without an LLM", () => {
    const stats = computeStats(ACTIVITIES);
    const narrative = fallbackNarrative(stats, computeFeatures(ACTIVITIES, stats));

    expect(narrative.profile).toMatch(/^This wallet is/);
    expect(narrative.insights.length).toBeGreaterThanOrEqual(2);
  });
});
