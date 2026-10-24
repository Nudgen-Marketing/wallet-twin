import { describe, expect, test } from "vitest";
import { createTatumHttp, type FetchLike, TatumHttpError } from "@/lib/tatum/http";

function scripted(responses: Array<Response | Error>): { fetch: FetchLike; calls: number } {
  const state = { calls: 0 };
  const fetch: FetchLike = async () => {
    const next = responses[state.calls];
    state.calls += 1;
    if (next instanceof Error) throw next;
    return next;
  };
  return {
    fetch,
    get calls() {
      return state.calls;
    },
  };
}

/** Virtual clock: sleeping advances time instantly so pacing is deterministic. */
function virtualClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

const ok = () => new Response("{}", { status: 200 });

describe("createTatumHttp", () => {
  test("paces request starts at least minIntervalMs apart", async () => {
    const clock = virtualClock();
    const source = scripted([ok(), ok(), ok()]);
    const http = createTatumHttp({ fetch: source.fetch, sleep: clock.sleep, now: clock.now, minIntervalMs: 350 });

    await http.request("https://tatum.test/a", {});
    await http.request("https://tatum.test/a", {});
    await http.request("https://tatum.test/a", {});

    expect(clock.sleeps).toEqual([350, 350]);
  });

  test("waits Retry-After on 429, then succeeds", async () => {
    const clock = virtualClock();
    const source = scripted([new Response("", { status: 429, headers: { "retry-after": "2" } }), ok()]);
    const http = createTatumHttp({ fetch: source.fetch, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    const response = await http.request("https://tatum.test/a", {});

    expect(response.status).toBe(200);
    expect(clock.sleeps).toContain(2000);
    expect(source.calls).toBe(2);
  });

  test("fails fast when Retry-After exceeds the wait budget", async () => {
    const clock = virtualClock();
    const source = scripted([
      new Response("", { status: 429, headers: { "retry-after": "600", "x-ttm-error-reason": "rate_limit_exceeded" } }),
    ]);
    const http = createTatumHttp({ fetch: source.fetch, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    await expect(http.request("https://tatum.test/a", {})).rejects.toMatchObject({
      name: "TatumHttpError",
      status: 429,
      reason: "rate_limit_exceeded",
    });
  });

  test("retries 5xx and network errors with backoff", async () => {
    const clock = virtualClock();
    const source = scripted([new Response("", { status: 502 }), new TypeError("socket hang up"), ok()]);
    const http = createTatumHttp({ fetch: source.fetch, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    await expect(http.request("https://tatum.test/a", {})).resolves.toHaveProperty("status", 200);
    expect(clock.sleeps).toEqual([500, 1000]);
  });

  test("does not retry client errors, and the error names the endpoint but never the key", async () => {
    const clock = virtualClock();
    const source = scripted([new Response("", { status: 401 })]);
    const http = createTatumHttp({ fetch: source.fetch, sleep: clock.sleep, now: clock.now, minIntervalMs: 0 });

    const error = await http
      .request("https://api.tatum.test/v4/data?symbol=SUI", { headers: { "x-api-key": "secret-key-123" } })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TatumHttpError);
    expect((error as Error).message).toContain("api.tatum.test/v4/data");
    expect((error as Error).message).not.toContain("secret-key-123");
    expect((error as Error).message).not.toContain("symbol=SUI");
    expect(source.calls).toBe(1);
  });

  test("gives up after maxRetries", async () => {
    const clock = virtualClock();
    const source = scripted(Array.from({ length: 5 }, () => new Response("", { status: 503 })));
    const http = createTatumHttp({
      fetch: source.fetch,
      sleep: clock.sleep,
      now: clock.now,
      minIntervalMs: 0,
      maxRetries: 2,
    });

    await expect(http.request("https://tatum.test/a", {})).rejects.toHaveProperty("status", 503);
    expect(source.calls).toBe(3);
  });
});
