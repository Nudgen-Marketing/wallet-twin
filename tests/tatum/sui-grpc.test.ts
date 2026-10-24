import { describe, expect, test } from "vitest";
import { type GrpcExecutedTransaction, isRetryableGrpcError, mapGrpcTransaction } from "@/lib/tatum/sui-grpc";

const ADDRESS = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

// Shaped like a sui.rpc.v2.ExecutedTransaction frame (proto enums: ADDRESS=1, CREATED=2, DELETED=3).
const RAW: GrpcExecutedTransaction = {
  digest: "9GAVJsvYdXJj6kyqDxpqrcKq3sPYyxgzCRQnQ6TFARQi",
  checkpoint: 337453366n,
  timestamp: { seconds: 1792814345n, nanos: 756_000_000 },
  transaction: {
    sender: ADDRESS,
    kind: {
      data: {
        oneofKind: "programmableTransaction",
        programmableTransaction: {
          commands: [
            { command: { oneofKind: "splitCoins" } },
            { command: { oneofKind: "moveCall", moveCall: { package: "0xabc", module: "router", function: "swap" } } },
          ],
        },
      },
    },
  },
  effects: {
    status: { success: true },
    gasUsed: { computationCost: 100000n, storageCost: 15412800n, storageRebate: 8754324n },
    changedObjects: [
      { objectId: "0x1", objectType: "0x2::coin::Coin<0x2::sui::SUI>", outputOwner: { kind: 1, address: ADDRESS }, idOperation: 2 },
      { objectId: "0x2", objectType: "0xabc::nft::Ape", inputOwner: { kind: 1, address: ADDRESS }, idOperation: 3 },
      { objectId: "0x3", objectType: "0xabc::pool::Pool", inputOwner: { kind: 3 }, outputOwner: { kind: 3 }, idOperation: 1 },
    ],
  },
  balanceChanges: [
    { address: ADDRESS, coinType: "0x2::sui::SUI", amount: "-6758476" },
    { address: ADDRESS, coinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC", amount: "169106339" },
  ],
};

describe("mapGrpcTransaction", () => {
  test("maps a gRPC executed transaction onto the shared SuiTransaction shape", () => {
    const tx = mapGrpcTransaction(RAW);

    expect(tx).toMatchObject({
      digest: RAW.digest,
      sender: ADDRESS,
      checkpoint: 337453366,
      timestampMs: 1792814345756,
      succeeded: true,
      gasCostMist: "6758476",
      isTruncated: false,
    });
    expect(tx.balanceChanges[0]).toEqual({ owner: ADDRESS, coinType: SUI, amount: "-6758476" });
    expect(tx.moveCalls).toEqual([{ package: `0x${"0".repeat(61)}abc`, module: "router", function: "swap" }]);
  });

  test("keeps object types, creation/deletion and address owners only", () => {
    const [coin, nft, pool] = mapGrpcTransaction(RAW).objectChanges;

    expect(coin).toMatchObject({ created: true, deleted: false, ownerBefore: null, ownerAfter: ADDRESS });
    expect(coin.objectType).toBe(`0x${"0".repeat(63)}2::coin::Coin<${SUI}>`);
    expect(nft).toMatchObject({ created: false, deleted: true, ownerBefore: ADDRESS, ownerAfter: null });
    expect(pool).toMatchObject({ ownerBefore: null, ownerAfter: null });
  });

  test("treats missing status as failure and missing fields as empty", () => {
    const tx = mapGrpcTransaction({ digest: "x", balanceChanges: [] });

    expect(tx).toMatchObject({ succeeded: false, sender: null, checkpoint: 0, gasCostMist: "0", moveCalls: [] });
  });
});

describe("isRetryableGrpcError", () => {
  test("retries rate limits and unavailability", () => {
    expect(isRetryableGrpcError(new Error("Received HTTP status code 429"))).toBe(true);
    expect(isRetryableGrpcError(Object.assign(new Error("busy"), { code: "UNAVAILABLE" }))).toBe(true);
    expect(isRetryableGrpcError(Object.assign(new Error("quota"), { code: 8 }))).toBe(true);
  });

  test("does not retry permanent errors", () => {
    expect(isRetryableGrpcError(Object.assign(new Error("bad key"), { code: "UNAUTHENTICATED" }))).toBe(false);
    expect(isRetryableGrpcError(new Error("invalid filter"))).toBe(false);
    expect(isRetryableGrpcError("429")).toBe(false);
  });
});
