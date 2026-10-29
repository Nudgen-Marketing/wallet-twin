import { absoluteUrl, SITE } from "@/lib/seo/site";

/**
 * /llms.txt (llmstxt.org): a plain-language map of the site for AI assistants and answer
 * engines, so they can describe WalletTwin and link the right pages without crawling it all.
 */
function llmsText(): string {
  return `# ${SITE.name}

> ${SITE.description}

${SITE.name} reads a Sui wallet's on-chain history through Tatum, turns it into trades, and writes the wallet's trading style, habits and milestones to Walrus Memory. The result is an AI "twin" of the wallet that people can chat with. Owners sign in with their Sui wallet (one gas-free signature). A twin stays private until its owner publishes it. Copy-trading is simulated paper trading: no real funds move and nothing is financial advice.

## Pages

- [Home](${absoluteUrl("/")}): what ${SITE.name} is and how it works
- [Leaderboard](${absoluteUrl("/leaderboard")}): published wallet twins ranked by the return of a simulated $1,000 paper copy, then win rate and realized PnL
- [Public twin](${absoluteUrl("/twin/")}{address}): one published wallet's trading profile, insights, milestones and stats, with a chat box that answers as that wallet
- [Agents (MCP)](${absoluteUrl("/connect")}): connect ${SITE.name} to Claude, ChatGPT, Cursor or any MCP client
- [Sitemap](${absoluteUrl("/sitemap.xml")}): every public page, including each published twin

## For AI agents

- Public MCP server, no sign-in: ${absoluteUrl("/api/mcp/public")} (Streamable HTTP; leaderboard, published twins and their public chat)
- Full MCP server: ${absoluteUrl("/api/mcp")} (OAuth 2.1 or a WalletTwin API key; acts for the signed-in wallet within the permissions it granted)
- OAuth discovery: ${absoluteUrl("/.well-known/oauth-authorization-server")}

## Notes

- Network: Sui mainnet
- Data sources: Tatum (on-chain history), Walrus Memory (twin memory), Anthropic Claude (chat)
- Prices and PnL are estimates; trading stats describe past activity only
`;
}

export function GET(): Response {
  return new Response(llmsText(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
