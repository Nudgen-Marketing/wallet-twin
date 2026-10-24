import { describe, expect, test } from "vitest";
import { fetchAddressHistory, type HistoryPage, type HistorySource } from "@/lib/tatum/history";
import type { SuiTransaction } from "@/lib/tatum/types";

function tx(digest: string, checkpoint: number): SuiTransaction {
  return {
    digest,
    sender: null,
    checkpoint,
    timestampMs: checkpoint * 1000,
    succeeded: true,
    gasCostMist: "0",
    balanceChanges: [],
    objectChanges: [],
    moveCalls: [],
    isTruncated: false,
  };
}

/** Serves scripted pages and records each request. */
function pagedSource(pages: HistoryPage[]) {
  const requests: Parameters<HistorySource["historyPage"]>[1][] = [];
  const source: HistorySource = {
    async historyPage(_address, request) {
      requests.push(request);
      const page = pages[requests.length - 1];
      if (!page) throw new Error("unexpected extra page request");
      return page;
    },
  };
  return { source, requests };
}

describe("fetchAddressHistory", () => {
  test("walks backwards until the cursor runs out and returns oldest first", async () => {
    const { source, requests } = pagedSource([
      { transactions: [tx("c", 30), tx("b", 20)], nextCursor: "p2" },
      { transactions: [tx("a", 10)], nextCursor: null },
    ]);

    const result = await fetchAddressHistory(source, "0x1", { pageSize: 2 });

    expect(result.transactions.map((t) => t.digest)).toEqual(["a", "b", "c"]);
    expect(result).toMatchObject({ hitCap: false, pages: 2 });
    expect(requests.map((r) => [r.direction, r.cursor])).toEqual([
      ["backward", null],
      ["backward", "p2"],
    ]);
  });

  test("stops at the cap and reports it", async () => {
    const { source, requests } = pagedSource([
      { transactions: [tx("e", 50), tx("d", 40)], nextCursor: "p2" },
      { transactions: [tx("c", 30)], nextCursor: "p3" },
    ]);

    const result = await fetchAddressHistory(source, "0x1", { pageSize: 2, maxTransactions: 3 });

    expect(result.transactions).toHaveLength(3);
    expect(result.hitCap).toBe(true);
    // Never asks for more than the remaining budget.
    expect(requests[1].pageSize).toBe(1);
  });

  test("keeps going past an empty page that still has a cursor (gRPC scan limit)", async () => {
    const { source } = pagedSource([
      { transactions: [], nextCursor: "scan-1" },
      { transactions: [tx("a", 10)], nextCursor: null },
    ]);

    const result = await fetchAddressHistory(source, "0x1");

    expect(result.transactions.map((t) => t.digest)).toEqual(["a"]);
  });

  test("de-duplicates repeated digests across pages", async () => {
    const { source } = pagedSource([
      { transactions: [tx("b", 20), tx("a", 10)], nextCursor: "p2" },
      { transactions: [tx("a", 10)], nextCursor: null },
    ]);

    const result = await fetchAddressHistory(source, "0x1");

    expect(result.transactions.map((t) => t.digest)).toEqual(["a", "b"]);
  });

  test("passes afterCheckpoint through for incremental sync", async () => {
    const { source, requests } = pagedSource([{ transactions: [], nextCursor: null }]);

    await fetchAddressHistory(source, "0x1", { afterCheckpoint: 99 });

    expect(requests[0].afterCheckpoint).toBe(99);
  });

  test("bails out of a source that never stops paging", async () => {
    const endless: HistorySource = {
      async historyPage() {
        return { transactions: [], nextCursor: "again" };
      },
    };

    const result = await fetchAddressHistory(endless, "0x1", { maxTransactions: 10, pageSize: 5 });

    expect(result).toMatchObject({ hitCap: true, pages: 8 });
  });
});
