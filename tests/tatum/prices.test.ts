import { describe, expect, test } from "vitest";
import { TatumHttpError, type TatumHttp } from "@/lib/tatum/http";
import { candleStart, createTatumPrices, OHLCV_URL, PRICEABLE_COINS } from "@/lib/tatum/prices";

const HOUR = 3_600_000;
// Real response shape (live call, 2026-10-24).
const SUI_CANDLE = {
  symbol: "SUI",
  openTime: 1792206000000,
  open: "1.00550000",
  high: "1.01620000",
  low: "1.00360000",
  close: "1.01250000",
  volume: "854016.40000000",
  closeTime: 1792209599999,
  quoteAssetVolume: "862644.36517000",
  numberOfTrades: 9149,
  takerBuyBaseAssetVolume: "478836.30000000",
  takerBuyQuoteAssetVolume: "483651.46278000",
};

function httpReturning(body: unknown, status = 200): { http: TatumHttp; urls: string[]; keys: string[] } {
  const urls: string[] = [];
  const keys: string[] = [];
  return {
    urls,
    keys,
    http: {
      async request(url, init) {
        urls.push(url);
        keys.push((init.headers as Record<string, string>)["x-api-key"]);
        if (status !== 200) throw new TatumHttpError(status, null, "api.tatum.io/v4/data/rate/symbol/OHLCV");
        return new Response(JSON.stringify(body), { status });
      },
    },
  };
}

describe("usdPriceAt", () => {
  test("requests the hour candle containing the timestamp and returns its close", async () => {
    const { http, urls, keys } = httpReturning(SUI_CANDLE);
    const prices = createTatumPrices({ apiKey: "key", http });
    const at = SUI_CANDLE.openTime + 25 * 60_000;

    const price = await prices.usdPriceAt("SUI", at);

    expect(price).toEqual({
      symbol: "SUI",
      usd: 1.0125,
      candleOpenMs: SUI_CANDLE.openTime,
      candleCloseMs: SUI_CANDLE.closeTime,
    });
    const url = new URL(urls[0]);
    expect(`${url.origin}${url.pathname}`).toBe(OHLCV_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      symbol: "SUI",
      unix: String(SUI_CANDLE.openTime),
      interval: "1h",
    });
    expect(keys[0]).toBe("key");
  });

  test("returns null instead of guessing when Tatum hands back a far-away candle", async () => {
    // Tatum answers out-of-range times with its earliest/latest record.
    const { http } = httpReturning(SUI_CANDLE);
    const prices = createTatumPrices({ apiKey: "key", http });

    await expect(prices.usdPriceAt("SUI", SUI_CANDLE.openTime + 30 * 24 * HOUR)).resolves.toBeNull();
  });

  test("tolerates the neighbouring candle", async () => {
    const { http } = httpReturning(SUI_CANDLE);
    const prices = createTatumPrices({ apiKey: "key", http });

    await expect(prices.usdPriceAt("SUI", SUI_CANDLE.openTime + 2 * HOUR)).resolves.toMatchObject({ usd: 1.0125 });
  });

  test("treats 404 (no data for symbol) as unknown", async () => {
    const { http } = httpReturning({}, 404);
    const prices = createTatumPrices({ apiKey: "key", http });

    await expect(prices.usdPriceAt("SUI", SUI_CANDLE.openTime)).resolves.toBeNull();
  });

  test("propagates other failures", async () => {
    const { http } = httpReturning({}, 401);
    const prices = createTatumPrices({ apiKey: "key", http });

    await expect(prices.usdPriceAt("SUI", SUI_CANDLE.openTime)).rejects.toBeInstanceOf(TatumHttpError);
  });
});

describe("candleStart", () => {
  test("floors to the interval boundary", () => {
    expect(candleStart(SUI_CANDLE.openTime + HOUR - 1, "1h")).toBe(SUI_CANDLE.openTime);
    expect(candleStart(SUI_CANDLE.openTime + HOUR, "1h")).toBe(SUI_CANDLE.openTime + HOUR);
  });
});

describe("PRICEABLE_COINS", () => {
  test("is keyed by full normalized coin types, never bare symbols", () => {
    for (const coinType of Object.keys(PRICEABLE_COINS)) {
      expect(coinType).toMatch(/^0x[0-9a-f]{64}::\w+::\w+$/);
    }
  });
});
