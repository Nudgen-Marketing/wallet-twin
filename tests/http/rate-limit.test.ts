import { describe, expect, test } from "vitest";
import { createRateLimiter } from "@/lib/http/rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit within a window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 10)).toBe(true);
    expect(limiter.take("ip", 20)).toBe(false);
  });

  test("resets when the window elapses", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 999)).toBe(false);
    expect(limiter.take("ip", 1_000)).toBe(true);
  });

  test("tracks keys independently", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("b", 0)).toBe(true);
    expect(limiter.take("a", 1)).toBe(false);
  });
});
