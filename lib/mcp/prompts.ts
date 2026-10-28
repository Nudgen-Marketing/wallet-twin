import "server-only";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { canUse, type ToolAccess } from "@/lib/mcp/define";
import type { McpPrincipal } from "@/lib/mcp/principal";
import { addressInput, NOTICE } from "@/lib/mcp/views";

/** Reusable starting points that show up as slash commands in many MCP clients. */

const userMessage = (text: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
});

export function registerPrompts(server: McpServer, principal: McpPrincipal): void {
  const allowed = (access: ToolAccess) => canUse(access, principal);

  if (allowed("public")) {
    server.registerPrompt(
      "should_i_copy",
      {
        title: "Size up a twin before paper-copying",
        description: "Review a published twin's simulated track record before paper-copying it.",
        argsSchema: z.object({ leader: addressInput }),
      },
      ({ leader }) =>
        userMessage(
          `Use get_public_twin for ${leader} and get_leaderboard for context. Summarize its trading style, ` +
            "win rate, realized PnL and simulated copy return, plus the risks its insights reveal. " +
            `Be explicit that copy trading on WalletTwin is simulated with paper money. ${NOTICE}`,
        ),
    );
  }

  if (allowed("twin:read")) {
    server.registerPrompt(
      "roast_my_trading",
      { title: "Roast my trading", description: "A kind but honest roast of your Sui trading, grounded in your twin's data." },
      () =>
        userMessage(
          "Use get_my_stats and recall_my_memories (query: 'worst habits and biggest losses') from WalletTwin. " +
            "Write a short, witty, kind roast of my trading that quotes at least three real numbers. No financial advice.",
        ),
    );
    server.registerPrompt(
      "weekly_review",
      { title: "Weekly trading review", description: "What changed in your wallet over the last 7 days." },
      () =>
        userMessage(
          "Use WalletTwin: get_sync_status (if the last sync is older than a day and you may, start_sync and wait), " +
            "then list_my_trades with since set to 7 days ago, get_my_stats and recall_my_memories (query: 'recent habits'). " +
            "Give me a weekly review: what I traded, wins and losses, habits I repeated, and one thing to watch. No financial advice.",
        ),
    );
  }
}
