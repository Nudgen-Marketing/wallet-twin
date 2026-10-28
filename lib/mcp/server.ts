import "server-only";
import { createMcpHandler } from "mcp-handler";
import { registerTools, type McpTool } from "@/lib/mcp/define";
import type { McpPrincipal } from "@/lib/mcp/principal";
import { registerPrompts } from "@/lib/mcp/prompts";
import { registerResources } from "@/lib/mcp/resources";
import { ACTION_TOOLS } from "@/lib/mcp/tools/actions";
import { PUBLIC_TOOLS } from "@/lib/mcp/tools/public";
import { TWIN_TOOLS } from "@/lib/mcp/tools/twin";

const INSTRUCTIONS = [
  "WalletTwin turns a Sui wallet's on-chain history (read through Tatum) into an AI twin whose memories live in Walrus Memory.",
  "Public tools read published twins and the leaderboard. Signed-in tools act for the connected wallet's own twin.",
  "Numbers are estimates: USD values can be unknown, and copy trading is simulated with paper money. Never present any of it as financial advice.",
].join(" ");

export const ALL_TOOLS: readonly McpTool[] = [...PUBLIC_TOOLS, ...TWIN_TOOLS, ...ACTION_TOOLS];

/** A stateless MCP handler for one request, exposing only what this caller may use. */
export function mcpHandlerFor(principal: McpPrincipal): (request: Request) => Promise<Response> {
  return createMcpHandler(
    (server) => {
      registerTools(server, principal, ALL_TOOLS);
      registerPrompts(server, principal);
      registerResources(server, principal);
    },
    { serverInfo: { name: "wallettwin", version: "1.0.0" }, instructions: INSTRUCTIONS },
  );
}
