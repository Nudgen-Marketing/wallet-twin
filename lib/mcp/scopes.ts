/** OAuth scopes an agent can hold. Shared by the authorization server, the consent page and the tools. */

export const MCP_SCOPES = ["twin:read", "twin:chat", "twin:remember", "twin:sync", "twin:publish", "copy:trade"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const SCOPE_INFO: Record<McpScope, { label: string; description: string }> = {
  "twin:read": { label: "Read your twin", description: "Stats, trades, memories, Wrapped, sync status and paper portfolio." },
  "twin:chat": {
    label: "Talk to your twin",
    description: "Ask your twin questions in its own voice. Its answers can draw on your private trades and notes.",
  },
  "twin:remember": { label: "Teach your twin", description: "Save facts you tell it into your private Walrus memory." },
  "twin:sync": { label: "Re-sync your wallet", description: "Pull new on-chain history from Tatum and write new memories." },
  "twin:publish": { label: "Publish or unpublish", description: "Put your twin on the public leaderboard, or take it off." },
  "copy:trade": { label: "Paper-copy twins", description: "Start or stop simulated copies of published twins. No real funds." },
};

/** Publishing changes what strangers can see, so the agent must ask for it explicitly. */
export const DEFAULT_SCOPES: readonly McpScope[] = MCP_SCOPES.filter((scope) => scope !== "twin:publish");

export function isMcpScope(value: string): value is McpScope {
  return (MCP_SCOPES as readonly string[]).includes(value);
}

/** Known scopes from a space-separated string or a list, deduplicated, in canonical order. */
export function parseScopes(input: string | readonly string[] | null | undefined): McpScope[] {
  if (!input) return [];
  const requested = new Set(typeof input === "string" ? input.split(/\s+/) : input);
  return MCP_SCOPES.filter((scope) => requested.has(scope));
}

export function formatScopes(scopes: readonly McpScope[]): string {
  return scopes.join(" ");
}
