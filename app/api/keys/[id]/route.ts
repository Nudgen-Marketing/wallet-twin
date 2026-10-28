import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin, ok } from "@/lib/http/api";
import { revokeApiKey } from "@/lib/mcp/auth/api-keys";

export async function DELETE(request: NextRequest, context: RouteContext<"/api/keys/[id]">) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to manage agent keys.", 401);
  const revoked = await revokeApiKey(session.address, (await context.params).id);
  if (!revoked) return fail("That key doesn't exist or was already revoked.", 404);
  return ok({ revoked: true });
}
