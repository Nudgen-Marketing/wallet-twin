import "server-only";
import { createRateLimiter, type RateLimiter } from "@/lib/http/rate-limit";
import type { McpPrincipal } from "@/lib/mcp/principal";

const MINUTE = 60_000;

/** Buckets on top of the per-caller limit: LLM calls and Tatum-heavy actions cost real money. */
export const LIMITS = {
  call: { limit: 60, windowMs: MINUTE },
  ask: { limit: 10, windowMs: MINUTE },
  sync: { limit: 6, windowMs: MINUTE },
  poll: { limit: 6, windowMs: MINUTE },
  follow: { limit: 10, windowMs: MINUTE },
} as const;

export type LimitBucket = Exclude<keyof typeof LIMITS, "call">;

const limiters = Object.fromEntries(
  Object.entries(LIMITS).map(([bucket, rule]) => [bucket, createRateLimiter(rule)]),
) as Record<keyof typeof LIMITS, RateLimiter>;

/** Records one call; false once the caller is over its overall or per-bucket limit. */
export function takeCall(principal: McpPrincipal, bucket?: LimitBucket): boolean {
  if (!limiters.call.take(principal.id)) return false;
  return bucket ? limiters[bucket].take(principal.id) : true;
}
