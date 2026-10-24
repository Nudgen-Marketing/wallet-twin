/**
 * Plumbing shared by every Tatum call: request pacing (the free plan's 3 req/s is shared
 * by HTTP and gRPC), Retry-After aware retries for 429s, and backoff for transient
 * 5xx/network errors.
 * Errors never include request headers, so the API key can't leak into logs.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;

export const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class TatumHttpError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    readonly endpoint: string,
  ) {
    super(`Tatum request to ${endpoint} failed with HTTP ${status}${reason ? ` (${reason})` : ""}`);
    this.name = "TatumHttpError";
  }
}

export interface RateGate {
  /** Resolves when the caller may start its request. */
  wait(): Promise<void>;
}

export interface RateGateOptions {
  /** Minimum gap between request starts. 350 ms keeps us under 3 req/s. */
  minIntervalMs?: number;
  sleep?: Sleep;
  now?: () => number;
}

/** Spaces out request starts; share one gate across every transport hitting the same plan. */
export function createRateGate(options: RateGateOptions = {}): RateGate {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const minIntervalMs = options.minIntervalMs ?? 350;
  let nextSlot = 0;

  return {
    async wait() {
      const start = Math.max(now(), nextSlot);
      nextSlot = start + minIntervalMs;
      const delay = start - now();
      if (delay > 0) await sleep(delay);
    },
  };
}

export interface TatumHttpOptions {
  fetch?: FetchLike;
  sleep?: Sleep;
  /** Shared pacing; defaults to a private gate built from minIntervalMs/now. */
  gate?: RateGate;
  minIntervalMs?: number;
  maxRetries?: number;
  /** Longest Retry-After we are willing to wait; longer limits fail fast. */
  maxRetryAfterMs?: number;
  now?: () => number;
}

export interface TatumHttp {
  request(url: string, init: RequestInit): Promise<Response>;
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function endpointLabel(url: string): string {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`;
}

export function createTatumHttp(options: TatumHttpOptions = {}): TatumHttp {
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? defaultSleep;
  const gate = options.gate ?? createRateGate({ minIntervalMs: options.minIntervalMs, sleep, now: options.now });
  const maxRetries = options.maxRetries ?? 3;
  const maxRetryAfterMs = options.maxRetryAfterMs ?? 65_000;

  async function request(url: string, init: RequestInit): Promise<Response> {
    const endpoint = endpointLabel(url);
    for (let attempt = 0; ; attempt += 1) {
      await gate.wait();
      let response: Response;
      try {
        response = await doFetch(url, init);
      } catch (error: unknown) {
        if (attempt >= maxRetries) throw error;
        await sleep(500 * 2 ** attempt);
        continue;
      }

      if (response.ok) return response;

      const reason = response.headers.get("x-ttm-error-reason");
      const canRetry = attempt < maxRetries;
      if (response.status === 429 && canRetry) {
        const wait = retryAfterMs(response) ?? 1000 * 2 ** attempt;
        if (wait > maxRetryAfterMs) throw new TatumHttpError(429, reason, endpoint);
        await sleep(wait);
        continue;
      }
      if (response.status >= 500 && canRetry) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new TatumHttpError(response.status, reason, endpoint);
    }
  }

  return { request };
}
