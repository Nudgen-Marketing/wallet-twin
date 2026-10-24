import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseSuiAddress } from "@/lib/auth/message";
import { getSession } from "@/lib/auth/session";
import { CopyError, followLeader, unfollowLeader } from "@/lib/copy/service";
import { fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";

const bodySchema = z.object({ leader: z.string().min(1).max(100), follow: z.boolean() });
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Start or stop a SIMULATED paper copy of a published twin. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to paper-copy a twin.", 401);
  if (!limiter.take(session.address)) return fail("Slow down a little.", 429);

  const parsed = bodySchema.safeParse(await readJson(request));
  const leader = parsed.success ? parseSuiAddress(parsed.data.leader) : null;
  if (!parsed.success || !leader) return fail("Malformed request.", 400);

  try {
    if (parsed.data.follow) await followLeader(session.address, leader);
    else await unfollowLeader(session.address, leader);
    return ok({ following: parsed.data.follow });
  } catch (error: unknown) {
    if (error instanceof CopyError) return fail(error.message, error.status);
    throw error;
  }
}
