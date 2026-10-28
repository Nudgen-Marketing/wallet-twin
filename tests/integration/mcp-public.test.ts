import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/copy/service", () => ({ backtestCopyReturnPct: async () => 8 }));
import { POST } from "@/app/api/mcp/public/route";
import { db } from "@/lib/db";
import { rememberTwin } from "@/lib/memory";
import { storeActivities } from "@/lib/twin/data";
import { publishTwin } from "@/lib/twin/publish";
import { connectMcp, resultText } from "@/tests/support/mcp";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const PUBLISHED = `0x${"a1".repeat(32)}`;
const PRIVATE = `0x${"b2".repeat(32)}`;
const T0 = Date.parse("2026-10-01T10:00:00Z");

async function seedTwin(address: string): Promise<void> {
  await storeActivities(address, [
    swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)),
    swap(T0 + 3_600_000, leg(MEME, 1000, null), leg(SUI, 130, 130)),
  ]);
  await db.syncState.create({ data: { address, lastSyncedAt: new Date() } });
  await rememberTwin(address, [
    { type: "profile", key: "profile:mcp", text: "(as of 2026-10-24) Flips MEME within the hour." },
    { type: "insight", key: "insight:mcp:0", text: "(as of 2026-10-24) Takes profit fast." },
    { type: "chat", key: "chat:mcp-secret", text: 'Owner said: "My seed phrase is under the mattress."' },
    { type: "trade", key: "trade:mcp-secret", text: "2026-10-01 bought 1000 MEME for 100 SUI (secret-trade)" },
  ]);
}

describe("public MCP endpoint", () => {
  beforeAll(async () => {
    await seedTwin(PUBLISHED);
    await seedTwin(PRIVATE);
    await publishTwin(PUBLISHED);
  });

  test("lists only the public tools and prompts", async () => {
    const client = await connectMcp(POST);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(
      ["ask_public_twin", "get_leaderboard", "get_public_twin", "list_demo_twins"],
    );
    expect(tools.find((tool) => tool.name === "get_leaderboard")?.annotations?.readOnlyHint).toBe(true);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(["should_i_copy"]);
  });

  test("get_leaderboard returns published twins with structured content", async () => {
    const client = await connectMcp(POST);
    const result = await client.callTool({ name: "get_leaderboard", arguments: { limit: 5 } });
    expect(result.isError).toBeFalsy();
    const twins = (result.structuredContent as { twins: { address: string; copyReturnPct: number }[] }).twins;
    expect(twins.map((twin) => twin.address)).toContain(PUBLISHED);
    expect(twins.map((twin) => twin.address)).not.toContain(PRIVATE);
  });

  test("get_public_twin shows the public view and never private memories", async () => {
    const client = await connectMcp(POST);
    const result = await client.callTool({ name: "get_public_twin", arguments: { address: PUBLISHED } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      address: PUBLISHED,
      profile: "Flips MEME within the hour.",
      insights: ["Takes profit fast."],
      stats: { swaps: 2, realizedPnlUsd: 30 },
    });
    const everything = JSON.stringify(result);
    expect(everything).not.toContain("mattress");
    expect(everything).not.toContain("secret-trade");
  });

  test("unpublished twins stay hidden", async () => {
    const client = await connectMcp(POST);
    const result = await client.callTool({ name: "get_public_twin", arguments: { address: PRIVATE } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("isn't public");
  });

  test("ask_public_twin explains when the server has no LLM", async () => {
    const client = await connectMcp(POST);
    const result = await client.callTool({ name: "ask_public_twin", arguments: { address: PUBLISHED, question: "Hi?" } });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("isn't configured");
  });

  test("rejects malformed arguments", async () => {
    const client = await connectMcp(POST);
    const result = await client.callTool({ name: "get_leaderboard", arguments: { limit: 500 } });
    expect(result.isError).toBe(true);
  });

  test("published twins are readable as resources", async () => {
    const client = await connectMcp(POST);
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toContain(`wallettwin://twin/${PUBLISHED}`);
    const read = await client.readResource({ uri: `wallettwin://twin/${PUBLISHED}` });
    const body = JSON.parse((read.contents[0] as { text: string }).text) as { profile: string };
    expect(body.profile).toBe("Flips MEME within the hour.");
  });

  test("answers CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/mcp/public/route");
    const response = await OPTIONS(new Request("http://localhost:3000/api/mcp/public", { method: "OPTIONS" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
