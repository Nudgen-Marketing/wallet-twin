import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildSignInMessage, NONCE_TTL_MS, parseSuiAddress } from "@/lib/auth/message";
import { db } from "@/lib/db";
import { clientIp, fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";

const bodySchema = z.object({ address: z.string().min(1).max(100) });
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  if (!limiter.take(clientIp(request))) return fail("Too many sign-in attempts. Try again in a minute.", 429);

  const parsed = bodySchema.safeParse(await readJson(request));
  const address = parsed.success ? parseSuiAddress(parsed.data.address) : null;
  if (!address) return fail("That doesn't look like a Sui address.", 400);

  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date();
  const message = buildSignInMessage({
    address,
    nonce,
    issuedAt,
    domain: request.nextUrl.host,
  });

  await db.authNonce.create({
    data: {
      nonce,
      address,
      message,
      expiresAt: new Date(issuedAt.getTime() + NONCE_TTL_MS),
    },
  });

  return ok({ nonce, message });
}
