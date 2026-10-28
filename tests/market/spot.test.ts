import { describe, expect, test } from "vitest";
import { COINGECKO_URL, createSpotPrices, SPOT_TOKENS } from "@/lib/market/spot";

// Real response shape (live call, 2026-10-28).
const BODY = {
  sui: { usd: 0.917184, usd_24h_change: -0.0944056427622398 },
  deep: { usd: 0.01648278, usd_24h_change: -0.873753900710812 },
  "walrus-2": { usd: 0.03305812, usd_24h_change: -3.4081761674654474 },
};

function fetchReturning(responses: Array<unknown | Error>) {
  const urls: string[] = [];
  const fetchFn = async (url: string) => {
    urls.push(url);
    const next = responses[Math.min(urls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), { status: 200 });
  };
  return { fetchFn, urls };
}

describe("spot prices", () => {
  test("asks CoinGecko for every ticker token and maps ids back to symbols", async () => {
    const { fetchFn, urls } = fetchReturning([BODY]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => 1_000 });

    const snapshot = await spot.get();

    expect(urls[0]).toContain(COINGECKO_URL);
    expect(urls[0]).toContain("ids=sui%2Cdeep%2Cwalrus-2");
    expect(snapshot.prices.map((p) => p.symbol)).toEqual(SPOT_TOKENS.map((t) => t.symbol));
    expect(snapshot.prices[0]).toEqual({ symbol: "SUI", usd: 0.917184, change24h: -0.0944056427622398 });
    expect(snapshot.fetchedAt).toBe(1_000);
  });

  test("serves the cached snapshot inside the TTL without calling upstream again", async () => {
    let clock = 0;
    const { fetchFn, urls } = fetchReturning([BODY]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => clock, ttlMs: 60_000 });

    await spot.get();
    clock = 59_000;
    await spot.get();

    expect(urls).toHaveLength(1);
  });

  test("shares one upstream call between concurrent requests", async () => {
    const { fetchFn, urls } = fetchReturning([BODY]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => 0 });

    await Promise.all([spot.get(), spot.get(), spot.get()]);

    expect(urls).toHaveLength(1);
  });

  test("keeps serving the last good snapshot when a refresh fails", async () => {
    let clock = 0;
    const { fetchFn } = fetchReturning([BODY, new Error("upstream down")]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => clock, ttlMs: 60_000 });

    await spot.get();
    clock = 120_000;
    const snapshot = await spot.get();

    expect(snapshot.fetchedAt).toBe(0);
    expect(snapshot.prices[0]?.usd).toBe(0.917184);
  });

  test("throws when upstream fails and there is nothing cached", async () => {
    const { fetchFn } = fetchReturning([new Error("upstream down")]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => 0 });

    await expect(spot.get()).rejects.toThrow("upstream down");
  });

  test("leaves a token null when upstream omits it or sends a bad price", async () => {
    const { fetchFn } = fetchReturning([{ sui: BODY.sui, deep: { usd: -1 } }]);
    const spot = createSpotPrices({ fetch: fetchFn, now: () => 0 });

    const snapshot = await spot.get();

    expect(snapshot.prices.map((p) => p.usd)).toEqual([0.917184, null, null]);
  });
});
