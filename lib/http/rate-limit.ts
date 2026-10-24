export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimiter {
  /** Records a hit for `key`; returns false once `key` is over the limit in the current window. */
  take(key: string, now?: number): boolean;
}

/**
 * Fixed-window, in-memory limiter. Good enough for a single-instance demo;
 * swap for a shared store (Redis/KV) before running more than one instance.
 */
export function createRateLimiter({ limit, windowMs }: RateLimitRule): RateLimiter {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    take(key, now = Date.now()) {
      const current = windows.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        windows.set(key, { startedAt: now, count: 1 });
        return true;
      }
      const next = { ...current, count: current.count + 1 };
      windows.set(key, next);
      return next.count <= limit;
    },
  };
}
