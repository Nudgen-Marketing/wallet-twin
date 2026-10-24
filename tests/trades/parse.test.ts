import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { createTatumSuiGraphQL } from "@/lib/tatum/sui-graphql";
import { isCollectibleType, parseActivity } from "@/lib/trades/parse";
import { FRIEND, ME, MEME, POOL, SUI, USDC, suiTx } from "@/tests/support/sui";

const NFT = `0x${"e".repeat(64)}::ape::Ape`;

describe("parseActivity", () => {
  test("swap: one coin out, another in, gas stripped from SUI", () => {
    const tx = suiTx({
      gasCostMist: "1000",
      balanceChanges: [
        { owner: ME, coinType: SUI, amount: "-5000001000" }, // 5 SUI + gas
        { owner: ME, coinType: MEME, amount: "777" },
        { owner: POOL, coinType: SUI, amount: "5000000000" },
      ],
      moveCalls: [{ package: POOL, module: "router", function: "swap_exact_in" }],
    });

    expect(parseActivity(tx, ME)).toMatchObject({
      kind: "swap",
      legsOut: [{ coinType: SUI, raw: "5000000000" }],
      legsIn: [{ coinType: MEME, raw: "777" }],
      gasMist: "1000",
      entrypoint: "router::swap_exact_in",
    });
  });

  test("gas-only SUI movement is not a trade leg", () => {
    const tx = suiTx({ balanceChanges: [{ owner: ME, coinType: SUI, amount: "-1000" }] });

    expect(parseActivity(tx, ME)).toMatchObject({ kind: "other", legsOut: [], legsIn: [] });
  });

  test("transfer out to another wallet names the recipient", () => {
    const tx = suiTx({
      balanceChanges: [
        { owner: ME, coinType: USDC, amount: "-10" },
        { owner: ME, coinType: SUI, amount: "-1000" },
        { owner: FRIEND, coinType: USDC, amount: "10" },
      ],
    });

    expect(parseActivity(tx, ME)).toMatchObject({ kind: "transfer_out", counterparty: FRIEND });
  });

  test("coins vanishing into a contract are a deposit, not a transfer", () => {
    const tx = suiTx({
      balanceChanges: [{ owner: ME, coinType: USDC, amount: "-10" }],
      moveCalls: [{ package: POOL, module: "lending", function: "deposit" }],
    });

    expect(parseActivity(tx, ME).kind).toBe("deposit");
  });

  test("incoming coins from someone else are a transfer in; self-initiated ones a withdraw", () => {
    const incoming = suiTx({ sender: FRIEND, balanceChanges: [{ owner: ME, coinType: USDC, amount: "10" }] });
    const claim = suiTx({ balanceChanges: [{ owner: ME, coinType: USDC, amount: "10" }, { owner: ME, coinType: SUI, amount: "-1000" }] });

    expect(parseActivity(incoming, ME)).toMatchObject({ kind: "transfer_in", counterparty: FRIEND, gasMist: "0" });
    expect(parseActivity(claim, ME).kind).toBe("withdraw");
  });

  test("NFT bought: collectible arrives while coins leave", () => {
    const tx = suiTx({
      balanceChanges: [{ owner: ME, coinType: SUI, amount: "-2000001000" }],
      objectChanges: [{ objectId: "0x1", objectType: NFT, created: false, deleted: false, ownerBefore: FRIEND, ownerAfter: ME }],
    });

    expect(parseActivity(tx, ME)).toMatchObject({ kind: "nft_buy", nftTypes: [NFT] });
  });

  test("NFT minted by the owner", () => {
    const tx = suiTx({
      objectChanges: [{ objectId: "0x1", objectType: NFT, created: true, deleted: false, ownerBefore: null, ownerAfter: ME }],
    });

    expect(parseActivity(tx, ME).kind).toBe("nft_mint");
  });

  test("NFT sold: collectible leaves while coins arrive", () => {
    const tx = suiTx({
      balanceChanges: [{ owner: ME, coinType: SUI, amount: "3000000000" }],
      objectChanges: [{ objectId: "0x1", objectType: NFT, created: false, deleted: false, ownerBefore: ME, ownerAfter: FRIEND }],
    });

    expect(parseActivity(tx, ME).kind).toBe("nft_sell");
  });

  test("native staking via 0x3::sui_system", () => {
    const stake = suiTx({ moveCalls: [{ package: `0x${"0".repeat(63)}3`, module: "sui_system", function: "request_add_stake" }] });
    const unstake = suiTx({
      moveCalls: [{ package: `0x${"0".repeat(63)}3`, module: "sui_system", function: "request_withdraw_stake" }],
    });

    expect(parseActivity(stake, ME).kind).toBe("stake");
    expect(parseActivity(unstake, ME).kind).toBe("unstake");
  });

  test("failed transactions are marked failed whatever moved", () => {
    expect(parseActivity(suiTx({ succeeded: false }), ME).kind).toBe("failed");
  });

  test("new coin objects don't count as collectibles", () => {
    expect(isCollectibleType(`0x${"0".repeat(63)}2::coin::Coin<${SUI}>`)).toBe(false);
    expect(isCollectibleType(`${POOL}::position::Position`)).toBe(false);
    expect(isCollectibleType(NFT)).toBe(true);
    expect(isCollectibleType(null)).toBe(false);
  });
});

describe("parseActivity on recorded mainnet transactions", () => {
  test("classifies the MAGMA → USDC router transaction as a swap", async () => {
    const response = new Response(readFileSync("tests/fixtures/tatum/history-page.json", "utf8"));
    const client = createTatumSuiGraphQL({ url: "https://tatum.test", http: { request: async () => response } });
    const trader = "0x854b8c1993e4396468f166a628e9926a2b18b398f104d8d3046c67bc32a2c940";
    const page = await client.historyPage(trader, { direction: "backward", pageSize: 20 });
    const swap = page.transactions.find((tx) => tx.digest === "9GAVJsvYdXJj6kyqDxpqrcKq3sPYyxgzCRQnQ6TFARQi")!;

    const activity = parseActivity(swap, trader);

    expect(activity.kind).toBe("swap");
    expect(activity.legsOut).toEqual([expect.objectContaining({ raw: "500000000000" })]);
    expect(activity.legsOut[0].coinType).toMatch(/::magma::MAGMA$/);
    expect(activity.legsIn).toEqual([{ coinType: USDC, raw: "169106339" }]);
  });
});
