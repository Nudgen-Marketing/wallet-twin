import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/http/api";
import { withCors } from "@/lib/mcp/cors";
import { anonymousPrincipal } from "@/lib/mcp/principal";
import { mcpHandlerFor } from "@/lib/mcp/server";

export const maxDuration = 60;

/** Anonymous MCP endpoint: leaderboard, published twins and their public chat. Rate-limited per IP. */
const handler = withCors((request: Request) =>
  mcpHandlerFor(anonymousPrincipal(clientIp(request as NextRequest)))(request),
);

export { handler as DELETE, handler as GET, handler as OPTIONS, handler as POST };
