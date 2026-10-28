import { withMcpAuth } from "mcp-handler";
import { verifyBearer, principalFromAuth } from "@/lib/mcp/auth/verify";
import { MCP_PATH, OAUTH_PATHS } from "@/lib/mcp/auth/urls";
import { withCors } from "@/lib/mcp/cors";
import { mcpHandlerFor } from "@/lib/mcp/server";

// start_sync keeps working after the response (after()), like the web sync route.
export const maxDuration = 300;

/**
 * Authenticated MCP endpoint: acts for the wallet behind an OAuth access token or API key.
 * A missing or invalid token gets a 401 whose WWW-Authenticate header starts the OAuth flow.
 */
const handler = withCors(
  withMcpAuth(
    async (request: Request) => {
      const principal = principalFromAuth(request.auth);
      if (!principal) return new Response("Unauthorized", { status: 401 });
      return mcpHandlerFor(principal)(request);
    },
    verifyBearer,
    { required: true, resourceMetadataPath: `${OAUTH_PATHS.protectedResource}${MCP_PATH}` },
  ),
);

export { handler as DELETE, handler as GET, handler as OPTIONS, handler as POST };
