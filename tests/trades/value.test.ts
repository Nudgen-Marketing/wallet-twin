import { describe, expect, test } from "vitest";
import type { ParsedActivity } from "@/lib/trades/types";
import { priceRequests, sideUsd, toUnits, valueActivity } from "@/lib/trades/value";
import { MEME, SUI } from "@/tests/support/sui";

const metas = new Map([
  [SUI, { symbol: "SUI", decimals: 9 }],
  [MEME, { symbol: "MEME", decimals: 6 }],
]);

const base: ParsedActivity = {
  digest: "D",
  checkpoint: 1,
  timestampMs: 1_790_000_000_000,
  kind: "swap",
  legsOut: [{ coinType: SUI, raw: "2500000000" }],
  legsIn: [{ coinType: MEME, raw: "1000000" }],
  gasMist: "0",
  counterparty: null,
  nftTypes: [],
  entrypoint: null,
};

describe("valueActivity", () => {
  test("values a swap from its priced side", () => {
    const valued = valueActivity(base, (type) => metas.get(type), (type) => (type === SUI ? 2 : null));

    expect(valued.legsOut[0]).toMatchObject({ symbol: "SUI", amount: 2.5, usd: 5 });
    expect(valued.legsIn[0]).toMatchObject({ symbol: "MEME", amount: 1, usd: null });
    expect(valued.usdValue).toBe(5);
  });

  test("unknown decimals mean unknown amount and value", () => {
    const valued = valueActivity(base, () => undefined, () => 2);

    expect(valued.legsOut[0]).toMatchObject({ amount: null, usd: null });
    expect(valued.usdValue).toBeNull();
  });

  test("transfers are not priced (keeps credit spend on trades)", () => {
    const valued = valueActivity({ ...base, kind: "transfer_out" }, (type) => metas.get(type), () => 2);

    expect(valued.usdValue).toBeNull();
    expect(priceRequests([{ ...base, kind: "transfer_out" }])).toEqual([]);
  });

  test("price requests cover both legs of trades", () => {
    expect(priceRequests([base])).toEqual([
      { coinType: SUI, atMs: base.timestampMs },
      { coinType: MEME, atMs: base.timestampMs },
    ]);
  });
});

describe("helpers", () => {
  test("toUnits divides by 10^decimals", () => {
    expect(toUnits("1500000000", 9)).toBe(1.5);
    expect(toUnits("1", null)).toBeNull();
  });

  test("sideUsd requires every leg to be priced", () => {
    expect(sideUsd([])).toBeNull();
    expect(sideUsd([{ coinType: SUI, raw: "1", symbol: "SUI", amount: 1, usd: 2 }])).toBe(2);
    expect(
      sideUsd([
        { coinType: SUI, raw: "1", symbol: "SUI", amount: 1, usd: 2 },
        { coinType: MEME, raw: "1", symbol: "MEME", amount: 1, usd: null },
      ]),
    ).toBeNull();
  });
});
