import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin, ok } from "@/lib/http/api";
import { revokeGrant } from "@/lib/mcp/auth/oauth";

/** Disconnects one of the signed-in wallet's connected apps and kills all its tokens. */
export async function DELETE(request: NextRequest, context: RouteContext<"/api/grants/[id]">) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to manage connected apps.", 401);
  if (!(await revokeGrant(session.address, (await context.params).id))) return fail("That app isn't connected.", 404);
  return ok({ revoked: true });
}
