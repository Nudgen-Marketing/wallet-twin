/**
 * Deterministic data for the Playwright e2e suite (run by e2e/global-setup.ts against
 * the wallet_twin_e2e Postgres database with the local memory backend). Never run against your dev database.
 */
import { db } from "@/lib/db";
import { rememberTwin } from "@/lib/memory";
import { computeStats } from "@/lib/trades/stats";
import type { ValuedActivity } from "@/lib/trades/types";
import { storeActivities } from "@/lib/twin/data";
import { leg, SUI, swap, USDC } from "@/tests/support/sui";

if (!process.env.DATABASE_URL?.includes("e2e")) {
  throw new Error("e2e-seed only runs against the e2e database (DATABASE_URL must contain 'e2e').");
}

const MAGMA = "0x9f854b3ad20f8161ec0886f15f4a1752bf75d22261556f14cc8d3a1c5d50e529::magma::MAGMA";
export const E2E_PRIVATE_FACT = "E2E-PRIVATE-FACT: my secret house fund";

const SCALPER = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
const SAVER = "0x4999139366a0c303b7cf1e683d24d1d8adb0de38e342fdfdee8788f8d1976c58";
const T0 = Date.parse("2026-10-01T09:00:00Z");
const HOUR = 3_600_000;

const scalperActivity: ValuedActivity[] = [
  swap(T0, leg(USDC, 100, 100), leg(MAGMA, 1000, null)),
  swap(T0 + 5 * HOUR, leg(MAGMA, 1000, null), leg(USDC, 150, 150)), // +$50
  swap(T0 + 24 * HOUR, leg(USDC, 200, 200), leg(MAGMA, 2500, null)),
  swap(T0 + 27 * HOUR, leg(MAGMA, 2500, null), leg(USDC, 160, 160)), // −$40
  swap(T0 + 48 * HOUR, leg(USDC, 50, 50), leg(MAGMA, 400, null)),
  swap(T0 + 50 * HOUR, leg(MAGMA, 400, null), leg(USDC, 70, 70)), // +$20
];

const saverActivity: ValuedActivity[] = [
  swap(T0, leg(USDC, 300, 300), leg(SUI, 100, 300)),
  swap(T0 + 72 * HOUR, leg(SUI, 100, 320), leg(USDC, 320, 320)), // +$20
];

async function seedTwin(address: string, activities: ValuedActivity[], copyReturnPct: number, profile: string) {
  await db.user.upsert({ where: { address }, create: { address }, update: {} });
  await storeActivities(address, activities);
  await db.syncState.upsert({
    where: { address },
    create: {
      address,
      lastCheckpoint: 1,
      historyFromMs: new Date("2026-01-23T22:30:07Z"),
      lastSyncedAt: new Date(),
    },
    update: {},
  });
  await rememberTwin(address, [
    { type: "profile", key: "profile:e2e", text: `(as of 2026-10-25) ${profile}` },
    { type: "insight", key: "insight:e2e:0", text: "(as of 2026-10-25) Sells within a few hours of buying." },
    { type: "insight", key: "insight:e2e:1", text: "(as of 2026-10-25) Trades mostly on weekday mornings UTC." },
    { type: "milestone", key: "milestone:e2e:win", text: "Biggest win: +$50.00 on the first round trip." },
    { type: "trade", key: "trade:e2e", text: "2026-10-01 14:00 UTC: swapped 1,000 MAGMA for 150 USDC (≈$150)." },
    { type: "chat", key: "chat:e2e", text: `Owner said: "${E2E_PRIVATE_FACT}"` },
  ]);
  const stats = computeStats(activities);
  const data = {
    swaps: stats.swapCount,
    closedTrades: stats.closedTrades,
    winRate: stats.winRate,
    realizedPnlUsd: stats.realizedPnlUsd,
    volumeUsd: stats.tradedVolumeUsd,
    copyReturnPct,
    favoriteToken: stats.favoriteTokens.find((token) => token.symbol !== "USDC")?.symbol ?? null,
    headline: profile.split(".")[0] + ".",
  };
  await db.publicTwin.upsert({ where: { address }, create: { address }, update: {} });
  await db.leaderboardEntry.upsert({ where: { address }, create: { address, ...data }, update: data });
}

async function main(): Promise<void> {
  await seedTwin(SCALPER, scalperActivity, 12.5, "This wallet scalps MAGMA in hours. It rarely holds overnight.");
  await seedTwin(SAVER, saverActivity, -3, "This wallet is a patient saver. It trades rarely.");
  process.stdout.write("e2e seed complete\n");
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
