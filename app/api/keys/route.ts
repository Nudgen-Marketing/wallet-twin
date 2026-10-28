import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { ApiKeyError, createApiKey, listApiKeys } from "@/lib/mcp/auth/api-keys";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(60),
  scopes: z.array(z.enum(MCP_SCOPES)).min(1),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365), z.null()]),
});
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Sign in to manage agent keys.", 401);
  return ok({ keys: await listApiKeys(session.address) }, { headers: { "Cache-Control": "no-store" } });
}

/** Creates a personal API key for MCP clients. The secret is in this response only. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to create an agent key.", 401);
  if (session.demo) return fail("Demo wallets are shared, so they can't have API keys. Connect with OAuth instead.", 403);
  if (!limiter.take(session.address)) return fail("Slow down a little.", 429);

  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Give the key a name and at least one permission.", 400);
  try {
    const created = await createApiKey({ address: session.address, ...parsed.data });
    return ok(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof ApiKeyError) return fail(error.message, error.status);
    throw error;
  }
}
