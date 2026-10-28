import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

type Handler = (request: Request) => Promise<Response>;

export const MCP_TEST_URL = "http://localhost:3000/api/mcp";

/** An MCP client wired straight to a route handler: no server, no network. */
export async function connectMcp(handler: Handler, options: { token?: string; url?: string } = {}): Promise<Client> {
  const client = new Client({ name: "wallettwin-tests", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(options.url ?? MCP_TEST_URL), {
    requestInit: options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined,
    fetch: (input, init) => handler(new Request(input, init)),
  });
  await client.connect(transport);
  return client;
}

/** The text content of a tool result. */
export function resultText(result: { content?: unknown }): string {
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return content.map((part) => part.text ?? "").join("\n");
}
