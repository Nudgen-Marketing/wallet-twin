/**
 * Client-side pacing for the Walrus Memory relayer, which limits each delegate key to
 * 60 weighted requests per minute (remember = 5, bulk = 10, recall = 1; verified from its
 * 429 response). We keep a sliding-window budget slightly under that, and retry 429s after
 * the relayer's `retry_after_seconds`.
 */

export type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const RELAYER_WEIGHT = { bulk: 10, remember: 5, recall: 1, status: 1 } as const;

export interface WeightedBudget {
  /** Waits until `weight` units fit in the window, then spends them. */
  take(weight: number): Promise<void>;
}

export function createWeightedBudget(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  sleep?: Sleep;
}): WeightedBudget {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  let spent: { at: number; weight: number }[] = [];
  let queue = Promise.resolve();

  async function reserve(weight: number): Promise<void> {
    for (;;) {
      const current = now();
      spent = spent.filter((entry) => current - entry.at < options.windowMs);
      const used = spent.reduce((total, entry) => total + entry.weight, 0);
      if (used + weight <= options.limit || spent.length === 0) {
        spent = [...spent, { at: current, weight }];
        return;
      }
      // Wait until the oldest spend leaves the window.
      await sleep(spent[0].at + options.windowMs - current + 5);
    }
  }

  return {
    take(weight) {
      // Serialize callers so concurrent requests can't both see the same free capacity.
      const turn = queue.then(() => reserve(weight));
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

/** Seconds the relayer asked us to wait, if `error` is its 429 response. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof Error) || !/\(429\)/.test(error.message)) return null;
  const match = /"retry_after_seconds"\s*:\s*(\d+)/.exec(error.message);
  return match ? Number(match[1]) : 60;
}

/** Runs `call`, waiting out relayer 429s (up to `maxRetries`). */
export async function withRelayerRetry<T>(
  call: () => Promise<T>,
  options: { maxRetries?: number; sleep?: Sleep } = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const maxRetries = options.maxRetries ?? 2;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error: unknown) {
      const wait = retryAfterSeconds(error);
      if (wait === null || attempt >= maxRetries) throw error;
      await sleep(wait * 1000 + 250);
    }
  }
}
