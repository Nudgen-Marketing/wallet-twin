import { describe, expect, test } from "vitest";
import { createWeightedBudget, retryAfterSeconds, withRelayerRetry } from "@/lib/memory/budget";

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

const RELAYER_429 =
  'Walrus Memory server error (429): {"error":"Rate limit exceeded","layer":"delegate_key","limit":"60 weighted-requests/min","retry_after_seconds":60}';

describe("createWeightedBudget", () => {
  test("lets calls through until the window is full, then waits for capacity", async () => {
    const clock = virtualClock();
    const budget = createWeightedBudget({ limit: 30, windowMs: 60_000, now: clock.now, sleep: clock.sleep });

    await budget.take(10);
    await budget.take(10);
    await budget.take(10);
    expect(clock.sleeps).toEqual([]);

    await budget.take(10); // needs the first spend to expire
    expect(clock.now()).toBeGreaterThanOrEqual(60_000);
  });

  test("six bulk writes fit a 60/min window; the seventh waits", async () => {
    const clock = virtualClock();
    const budget = createWeightedBudget({ limit: 60, windowMs: 60_000, now: clock.now, sleep: clock.sleep });

    for (let index = 0; index < 6; index += 1) await budget.take(10);
    expect(clock.now()).toBe(0);
    await budget.take(10);
    expect(clock.now()).toBeGreaterThanOrEqual(60_000);
  });
});

describe("relayer 429 handling", () => {
  test("reads retry_after_seconds from the relayer error", () => {
    expect(retryAfterSeconds(new Error(RELAYER_429))).toBe(60);
    expect(retryAfterSeconds(new Error("Walrus Memory server error (500): boom"))).toBeNull();
    expect(retryAfterSeconds("429")).toBeNull();
  });

  test("retries after the requested wait, then succeeds", async () => {
    const clock = virtualClock();
    let calls = 0;
    const result = await withRelayerRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error(RELAYER_429);
        return "ok";
      },
      { sleep: clock.sleep },
    );

    expect(result).toBe("ok");
    expect(clock.sleeps).toEqual([60_250]);
  });

  test("gives up after maxRetries and never retries other errors", async () => {
    const clock = virtualClock();
    await expect(
      withRelayerRetry(async () => Promise.reject(new Error(RELAYER_429)), { sleep: clock.sleep, maxRetries: 1 }),
    ).rejects.toThrow(/429/);
    await expect(withRelayerRetry(async () => Promise.reject(new Error("bad request")), { sleep: clock.sleep })).rejects.toThrow(
      "bad request",
    );
    expect(clock.sleeps).toHaveLength(1);
  });
});
