import type { NextRequest } from "next/server";
import { z } from "zod";
import { checkNonce, parseSuiAddress } from "@/lib/auth/message";
import { startSession } from "@/lib/auth/session";
import { SignatureCheckUnavailableError, verifySignInSignature } from "@/lib/auth/signature";
import { db } from "@/lib/db";
import { clientIp, fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { tatumSuiClient } from "@/lib/tatum";

const bodySchema = z.object({
  address: z.string().min(1).max(100),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  signature: z.string().min(1).max(10_000),
});
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const EXPIRED = "This sign-in request expired. Please try again.";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  if (!limiter.take(clientIp(request))) return fail("Too many sign-in attempts. Try again in a minute.", 429);

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Malformed sign-in request.", 400);
  const address = parseSuiAddress(parsed.data.address);
  if (!address) return fail("That doesn't look like a Sui address.", 400);

  const now = new Date();
  const record = await db.authNonce.findUnique({ where: { nonce: parsed.data.nonce } });
  if (!record || checkNonce(record, address, now)) return fail(EXPIRED, 401);

  // Claim the nonce atomically so a replayed signature can't win a race.
  const claimed = await db.authNonce.updateMany({
    where: { nonce: record.nonce, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return fail(EXPIRED, 401);

  let isValid: boolean;
  try {
    isValid = await verifySignInSignature(
      record.message,
      parsed.data.signature,
      address,
      tatumSuiClient(),
    );
  } catch (error: unknown) {
    if (error instanceof SignatureCheckUnavailableError) {
      console.error("[auth] signature check unavailable", error.cause);
      return fail("We couldn't verify your signature right now. Please try again.", 503);
    }
    throw error;
  }
  if (!isValid) return fail("Signature didn't match this wallet.", 401);

  await db.user.upsert({
    where: { address },
    create: { address },
    update: { lastLogin: now },
  });
  await startSession({ address });

  return ok({ address });
}
