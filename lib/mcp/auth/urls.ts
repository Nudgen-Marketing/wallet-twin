import { getPublicOrigin } from "mcp-handler";

/** The authenticated MCP endpoint. Its absolute URL is the OAuth resource (RFC 8707) tokens are bound to. */
export const MCP_PATH = "/api/mcp";
export const PUBLIC_MCP_PATH = "/api/mcp/public";

export const OAUTH_PATHS = {
  authorize: "/oauth/authorize",
  tokenEndpoint: "/api/oauth/token",
  register: "/api/oauth/register",
  revoke: "/api/oauth/revoke",
  protectedResource: "/.well-known/oauth-protected-resource",
  authorizationServer: "/.well-known/oauth-authorization-server",
} as const;

/** Public origin of a request, honoring the reverse proxy's X-Forwarded-* headers. */
export function publicOrigin(request: Request): string {
  return getPublicOrigin(request);
}

export function mcpResourceUrl(origin: string): string {
  return `${origin}${MCP_PATH}`;
}
