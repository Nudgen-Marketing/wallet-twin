import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { oauthError, oauthJson, preflight, readParams } from "@/lib/mcp/auth/http";
import { exchangeCode, OAuthFlowError, refreshTokens } from "@/lib/mcp/auth/oauth";
import { publicOrigin } from "@/lib/mcp/auth/urls";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** OAuth token endpoint: authorization_code (+PKCE) and refresh_token grants for public clients. */
export async function POST(request: NextRequest) {
  if (!limiter.take(clientIp(request))) return oauthJson({ error: "slow_down", error_description: "Too many requests." }, 429);
  const params = await readParams(request);
  try {
    if (!params.client_id) throw new OAuthFlowError("invalid_client", "client_id is required.", 401);
    if (params.grant_type === "authorization_code") {
      if (!params.code || !params.code_verifier || !params.redirect_uri) {
        throw new OAuthFlowError("invalid_request", "code, code_verifier and redirect_uri are required.");
      }
      return oauthJson(
        await exchangeCode(
          {
            code: params.code,
            codeVerifier: params.code_verifier,
            clientId: params.client_id,
            redirectUri: params.redirect_uri,
            resource: params.resource,
          },
          publicOrigin(request),
        ),
      );
    }
    if (params.grant_type === "refresh_token") {
      if (!params.refresh_token) throw new OAuthFlowError("invalid_request", "refresh_token is required.");
      return oauthJson(await refreshTokens({ refreshToken: params.refresh_token, clientId: params.client_id, scope: params.scope }));
    }
    throw new OAuthFlowError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (error: unknown) {
    return oauthError(error);
  }
}

export const OPTIONS = preflight;
