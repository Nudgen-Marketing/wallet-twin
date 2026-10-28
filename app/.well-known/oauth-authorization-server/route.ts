import { CORS_HEADERS } from "@/lib/mcp/cors";
import { OAUTH_PATHS, publicOrigin } from "@/lib/mcp/auth/urls";
import { preflight } from "@/lib/mcp/auth/http";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

/** RFC 8414 authorization server metadata. The issuer is this app's own origin. */
export function GET(request: Request) {
  const origin = publicOrigin(request);
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}${OAUTH_PATHS.authorize}`,
      token_endpoint: `${origin}${OAUTH_PATHS.tokenEndpoint}`,
      registration_endpoint: `${origin}${OAUTH_PATHS.register}`,
      revocation_endpoint: `${origin}${OAUTH_PATHS.revoke}`,
      scopes_supported: MCP_SCOPES,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      revocation_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${origin}/connect`,
    },
    { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" } },
  );
}

export const OPTIONS = preflight;
