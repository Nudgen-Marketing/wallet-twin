import { generateProtectedResourceMetadata } from "mcp-handler";
import { CORS_HEADERS } from "@/lib/mcp/cors";
import { preflight } from "@/lib/mcp/auth/http";
import { MCP_PATH, mcpResourceUrl, publicOrigin } from "@/lib/mcp/auth/urls";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

/**
 * RFC 9728 protected resource metadata, at the root and path-suffixed for /api/mcp
 * (the URL our 401 challenge points clients to).
 */
export async function GET(request: Request, context: RouteContext<"/.well-known/oauth-protected-resource/[[...path]]">) {
  const { path } = await context.params;
  const suffix = path?.length ? `/${path.join("/")}` : "";
  if (suffix && suffix !== MCP_PATH) return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  const origin = publicOrigin(request);
  const metadata = generateProtectedResourceMetadata({
    authServerUrls: [origin],
    resourceUrl: mcpResourceUrl(origin),
    additionalMetadata: {
      scopes_supported: [...MCP_SCOPES],
      bearer_methods_supported: ["header"],
      resource_name: "WalletTwin",
      resource_documentation: `${origin}/connect`,
    },
  });
  return Response.json(metadata, { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
}

export const OPTIONS = preflight;
