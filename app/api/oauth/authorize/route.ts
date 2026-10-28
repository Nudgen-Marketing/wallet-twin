import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin } from "@/lib/http/api";
import { approveConsent, denyConsent, openConsent } from "@/lib/mcp/auth/oauth";
import { publicOrigin } from "@/lib/mcp/auth/urls";
import { parseScopes } from "@/lib/mcp/scopes";

/** The consent form posts here. The request it approves is sealed, so only the scopes can change. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in with your wallet first.", 401);

  const form = await request.formData();
  const sealed = form.get("request");
  const consent = typeof sealed === "string" ? await openConsent(sealed) : null;
  if (!consent) return fail("This approval expired. Start connecting from your app again.", 400);

  const origin = publicOrigin(request);
  const target =
    form.get("decision") === "approve"
      ? await approveConsent(consent, session, parseScopes(form.getAll("scope").map(String)), origin)
      : denyConsent(consent, origin);
  // 303 so the browser follows with a GET, without re-posting the form to the client.
  return NextResponse.redirect(target, 303);
}
