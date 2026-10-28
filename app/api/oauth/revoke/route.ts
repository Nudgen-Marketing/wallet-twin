import { oauthError, preflight, readParams } from "@/lib/mcp/auth/http";
import { revokeToken } from "@/lib/mcp/auth/oauth";
import { CORS_HEADERS } from "@/lib/mcp/cors";

/** RFC 7009 token revocation. Always 200, even for unknown tokens, so it can't be used as an oracle. */
export async function POST(request: Request) {
  const { token } = await readParams(request);
  try {
    if (token) await revokeToken(token);
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  } catch (error: unknown) {
    return oauthError(error);
  }
}

export const OPTIONS = preflight;
