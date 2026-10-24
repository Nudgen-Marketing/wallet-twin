import { after, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { clientIp, fail, isSameOrigin, ok } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { runSync, startSyncRun } from "@/lib/sync/run";

// The pipeline keeps running after the response (Tatum paging + pricing + memory writes).
export const maxDuration = 300;

const limiter = createRateLimiter({ limit: 6, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to sync your wallet.", 401);
  if (!limiter.take(`${session.address}|${clientIp(request)}`)) {
    return fail("You just synced. Give it a minute.", 429);
  }

  const { runId, alreadyRunning } = await startSyncRun(session.address);
  if (!alreadyRunning) after(() => runSync(runId, session.address));
  return ok({ runId, alreadyRunning });
}
