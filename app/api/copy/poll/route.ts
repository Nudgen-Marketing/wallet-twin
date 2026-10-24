import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { pollFollows } from "@/lib/copy/service";
import { fail, isSameOrigin, ok } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";

export const maxDuration = 120;

// Tatum has no Sui webhooks, so new leader trades are pulled on demand.
const limiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to see your paper portfolio.", 401);
  if (!limiter.take(session.address)) return fail("Already checked a moment ago.", 429);

  try {
    return ok(await pollFollows(session.address));
  } catch (error: unknown) {
    console.error("[copy] poll failed", error instanceof Error ? error.message : error);
    return fail("Couldn't reach Tatum to check for new trades. Try again shortly.", 502);
  }
}
