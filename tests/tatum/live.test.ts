/**
 * Live checks against Tatum mainnet. Opt-in (uses real credits):
 *   TATUM_LIVE=1 pnpm test tests/tatum/live
 */
import { config } from "dotenv";
import { describe, expect, test } from "vitest";
import { fetchAddressHistory } from "@/lib/tatum/history";
import { createRateGate, createTatumHttp } from "@/lib/tatum/http";
import { createTatumPrices } from "@/lib/tatum/prices";
import { createTatumSuiGraphQL } from "@/lib/tatum/sui-graphql";
import { createTatumSuiGrpc } from "@/lib/tatum/sui-grpc";

config({ path: ".env.local", quiet: true });

const LIVE = process.env.TATUM_LIVE === "1";
const apiKey = process.env.TATUM_API_KEY ?? "";

/** Active swapper on 2026-10-24 (MAGMA → USDC via an aggregator router). */
const RECENT_TRADER = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
/** Address with activity in Jan 2026, before the GraphQL address index starts. */
const EARLY_ADDRESS = "0x0feb54a725aa357ff2f5bc6bb023c05b310285bd861275a30521f339a434ebb3";
/** First checkpoint GraphQL serves for affectedAddress filters (~26 Jul 2026). */
const GRAPHQL_ADDRESS_FLOOR = 303_236_578;

const gate = createRateGate();
const http = createTatumHttp({ gate });
const graphql = createTatumSuiGraphQL({ url: "https://sui-mainnet.gateway.tatum.io/graphql", apiKey, http });
const grpc = () => createTatumSuiGrpc({ host: "sui-mainnet-grpc.gateway.tatum.io:443", apiKey, gate });

describe.skipIf(!LIVE)("Tatum mainnet (live)", { timeout: 60_000 }, () => {
  test("GraphQL pages a known trader's history", async () => {
    const page = await graphql.historyPage(RECENT_TRADER, { direction: "backward", pageSize: 5 });

    expect(page.transactions).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
    for (const tx of page.transactions) {
      expect(tx.digest).toMatch(/^[1-9A-HJ-NP-Za-km-z]{43,44}$/);
      expect(tx.checkpoint).toBeGreaterThan(GRAPHQL_ADDRESS_FLOOR);
      expect(tx.balanceChanges.length).toBeGreaterThan(0);
    }
  });

  test("gRPC and GraphQL agree on the same newest transactions", async () => {
    const [viaGraphql, viaGrpc] = await Promise.all([
      graphql.historyPage(RECENT_TRADER, { direction: "backward", pageSize: 5, afterCheckpoint: 337_000_000 }),
      grpc().historyPage(RECENT_TRADER, { direction: "backward", pageSize: 5, afterCheckpoint: 337_000_000 }),
    ]);

    const graphqlDigests = new Set(viaGraphql.transactions.map((tx) => tx.digest));
    const overlap = viaGrpc.transactions.filter((tx) => graphqlDigests.has(tx.digest));
    expect(overlap.length).toBeGreaterThanOrEqual(3);
    for (const fromGrpc of overlap) {
      const fromGraphql = viaGraphql.transactions.find((tx) => tx.digest === fromGrpc.digest)!;
      expect(fromGrpc.checkpoint).toBe(fromGraphql.checkpoint);
      expect(fromGrpc.timestampMs).toBe(fromGraphql.timestampMs);
      expect(fromGrpc.gasCostMist).toBe(fromGraphql.gasCostMist);
      expect(new Set(fromGrpc.balanceChanges.map((c) => `${c.owner}|${c.coinType}|${c.amount}`))).toEqual(
        new Set(fromGraphql.balanceChanges.map((c) => `${c.owner}|${c.coinType}|${c.amount}`)),
      );
    }
  });

  test("gRPC reaches address history older than the GraphQL window", async () => {
    // Walk backwards from just past the GraphQL floor by requesting only the oldest slice.
    const page = await grpc().historyPage(EARLY_ADDRESS, { direction: "forward", pageSize: 3 });

    expect(page.transactions.length).toBeGreaterThan(0);
    expect(page.transactions[0].checkpoint).toBeLessThan(GRAPHQL_ADDRESS_FLOOR);
  });

  test("fetchAddressHistory paginates with a cap over gRPC", async () => {
    const result = await fetchAddressHistory(grpc(), RECENT_TRADER, { maxTransactions: 60, pageSize: 25 });

    expect(result.transactions).toHaveLength(60);
    expect(result.hitCap).toBe(true);
    expect(result.pages).toBeGreaterThanOrEqual(3);
    const checkpoints = result.transactions.map((tx) => tx.checkpoint);
    expect(checkpoints).toEqual([...checkpoints].sort((a, b) => a - b));
  });

  test("OHLCV prices SUI at a past hour", async () => {
    const prices = createTatumPrices({ apiKey, http });
    const weekAgo = Date.now() - 7 * 24 * 3_600_000;

    const price = await prices.usdPriceAt("SUI", weekAgo);

    expect(price?.symbol).toBe("SUI");
    expect(price?.usd).toBeGreaterThan(0);
  });
});
