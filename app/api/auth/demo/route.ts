import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseSuiAddress } from "@/lib/auth/message";
import { startSession } from "@/lib/auth/session";
import { isDemoWallet } from "@/lib/demo";
import { clientIp, fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";

const bodySchema = z.object({ address: z.string().min(1).max(100) });
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Signs a visitor in as one of the seeded demo wallets (no wallet needed, flagged as demo). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  if (!limiter.take(clientIp(request))) return fail("Too many attempts. Try again in a minute.", 429);

  const parsed = bodySchema.safeParse(await readJson(request));
  const address = parsed.success ? parseSuiAddress(parsed.data.address) : null;
  if (!address || !isDemoWallet(address)) return fail("That isn't one of the demo wallets.", 404);

  await startSession({ address, demo: true });
  return ok({ address, demo: true });
}
