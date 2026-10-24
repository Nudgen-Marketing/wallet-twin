import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { TatumHttp } from "@/lib/tatum/http";
import { createTatumSuiGraphQL, TatumGraphQLError } from "@/lib/tatum/sui-graphql";

const ADDRESS = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`tests/fixtures/tatum/${name}.json`, "utf8"));
}

interface Recorded {
  url: string;
  body: { query: string; variables: Record<string, unknown> };
  headers: Record<string, string>;
}

function fakeHttp(response: unknown): { http: TatumHttp; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const http: TatumHttp = {
    async request(url, init) {
      calls.push({
        url,
        body: JSON.parse(String(init.body)),
        headers: init.headers as Record<string, string>,
      });
      return new Response(JSON.stringify(response), { status: 200 });
    },
  };
  return { http, calls };
}

describe("TatumSuiGraphQL.historyPage (recorded mainnet fixture)", () => {
  test("maps every transaction in the page", async () => {
    const { http } = fakeHttp(fixture("history-page"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    const page = await client.historyPage(ADDRESS, { direction: "backward", pageSize: 20 });

    expect(page.transactions).toHaveLength(20);
    expect(page.transactions.every((tx) => tx.digest && tx.checkpoint > 0 && tx.timestampMs > 0)).toBe(true);
  });

  test("decodes a real swap: MAGMA out, USDC in, SUI only for gas", async () => {
    const { http } = fakeHttp(fixture("history-page"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    const page = await client.historyPage(ADDRESS, { direction: "backward", pageSize: 20 });
    const swap = page.transactions.find((tx) => tx.digest === "9GAVJsvYdXJj6kyqDxpqrcKq3sPYyxgzCRQnQ6TFARQi");

    expect(swap).toMatchObject({
      sender: ADDRESS,
      checkpoint: 337453366,
      timestampMs: Date.parse("2026-10-24T03:59:05.756Z"),
      succeeded: true,
      gasCostMist: "6758476",
      isTruncated: false,
    });
    const mine = swap!.balanceChanges.filter((change) => change.owner === ADDRESS);
    expect(mine).toEqual(
      expect.arrayContaining([
        { owner: ADDRESS, coinType: SUI, amount: "-6758476" },
        { owner: ADDRESS, coinType: USDC, amount: "169106339" },
      ]),
    );
    expect(mine.find((change) => change.coinType.endsWith("::magma::MAGMA"))?.amount).toBe("-500000000000");
    expect(swap!.moveCalls.map((call) => call.module)).toContain("router");
    expect(swap!.objectChanges.some((change) => change.created && change.ownerAfter === ADDRESS)).toBe(true);
  });

  test("pages backwards with last/before and an affectedAddress filter", async () => {
    const { http, calls } = fakeHttp(fixture("history-page"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", apiKey: "k", http });

    const page = await client.historyPage("0x854B8C1993E4396468F166A628E9926A2B18B398F104D8D3046C67BC32A2C940", {
      direction: "backward",
      cursor: "abc",
      pageSize: 20,
      afterCheckpoint: 5,
    });

    expect(calls[0].body.variables).toEqual({
      last: 20,
      before: "abc",
      filter: { affectedAddress: ADDRESS, afterCheckpoint: 5 },
    });
    expect(calls[0].headers["x-api-key"]).toBe("k");
    // Fixture pageInfo: hasPreviousPage = true, startCursor = KAE6CAgAELjex8kX
    expect(page.nextCursor).toBe("KAE6CAgAELjex8kX");
  });

  test("pages forwards with first/after and stops when hasNextPage is false", async () => {
    const { http, calls } = fakeHttp(fixture("history-page"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    const page = await client.historyPage(ADDRESS, { direction: "forward", pageSize: 10 });

    expect(calls[0].body.variables).toMatchObject({ first: 10, after: null });
    expect(calls[0].headers).not.toHaveProperty("x-api-key");
    expect(page.nextCursor).toBeNull();
  });

  test("surfaces GraphQL errors instead of returning empty data", async () => {
    const { http } = fakeHttp({ data: null, errors: [{ message: "Query is too complex" }] });
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    await expect(client.historyPage(ADDRESS, { direction: "backward", pageSize: 5 })).rejects.toThrow(
      TatumGraphQLError,
    );
  });

  test("rejects responses that don't match the schema", async () => {
    const { http } = fakeHttp({ data: { transactions: { nodes: "nope" } } });
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    await expect(client.historyPage(ADDRESS, { direction: "backward", pageSize: 5 })).rejects.toThrow();
  });
});

describe("TatumSuiGraphQL.historyRange / coinInfo", () => {
  test("reads the indexed window for address-filtered history", async () => {
    const { http, calls } = fakeHttp(fixture("history-range"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    const range = await client.historyRange({ addressFiltered: true });

    expect(calls[0].body.variables).toEqual({ filters: ["affectedAddress"] });
    expect(range).toEqual({
      firstCheckpoint: 303237845,
      firstTimestampMs: Date.parse("2026-07-26T15:05:29.699Z"),
      lastCheckpoint: 337453371,
      lastTimestampMs: Date.parse("2026-10-24T03:59:06.865Z"),
    });
  });

  test("normalizes the coin type and returns metadata", async () => {
    const { http, calls } = fakeHttp(fixture("coin-metadata-sui"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test/graphql", http });

    await expect(client.coinInfo("0x2::sui::SUI")).resolves.toEqual({
      coinType: SUI,
      symbol: "SUI",
      name: "Sui",
      decimals: 9,
    });
    expect(calls[0].body.variables).toEqual({ coinType: SUI });
  });
});
