import "server-only";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { canUse } from "@/lib/mcp/define";
import type { McpPrincipal } from "@/lib/mcp/principal";
import { publicTwinData } from "@/lib/mcp/tools/public";
import { getLeaderboard } from "@/lib/twin/publish";

const json = (uri: URL, data: unknown) => ({
  contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }],
});

export function registerResources(server: McpServer, principal: McpPrincipal): void {
  if (!canUse("public", principal)) return;
  server.registerResource(
    "public-twin",
    new ResourceTemplate("wallettwin://twin/{address}", {
      list: async () => ({
        resources: (await getLeaderboard(50)).map((row) => ({
          uri: `wallettwin://twin/${row.address}`,
          name: row.headline ?? row.address,
          mimeType: "application/json",
        })),
      }),
      complete: {
        address: async (value) =>
          (await getLeaderboard(50)).map((row) => row.address).filter((address) => address.startsWith(value)),
      },
    }),
    {
      title: "Published twin",
      description: "A published twin's public profile, insights, milestones and stats.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const address = Array.isArray(variables.address) ? variables.address[0] : variables.address;
      const data = address ? await publicTwinData(address) : null;
      return json(uri, data ?? { error: "That twin isn't public." });
    },
  );
}
