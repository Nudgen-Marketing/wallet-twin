import type { McpScope } from "@/lib/mcp/scopes";

/** Who is calling an MCP tool. Anonymous callers only reach the public endpoint. */
export interface McpPrincipal {
  kind: "anonymous" | "oauth" | "api_key";
  /** Stable id for rate limiting: grant id, key id, or ip for anonymous callers. */
  id: string;
  address: string | null;
  /** Shared demo login: same limits as the web demo (nothing saved, can't unpublish). */
  demo: boolean;
  scopes: readonly McpScope[];
}

export type SignedInPrincipal = McpPrincipal & { address: string };

export function anonymousPrincipal(ip: string): McpPrincipal {
  return { kind: "anonymous", id: `ip:${ip}`, address: null, demo: false, scopes: [] };
}

export function isSignedIn(principal: McpPrincipal): principal is SignedInPrincipal {
  return principal.kind !== "anonymous" && principal.address !== null;
}

export function hasScope(principal: McpPrincipal, scope: McpScope): boolean {
  return isSignedIn(principal) && principal.scopes.includes(scope);
}
