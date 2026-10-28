import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/copy/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/copy/service")>()),
  backtestCopyReturnPct: async () => 5,
}));
vi.mock("@/lib/sync/run", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync/run")>()),
  runSync: vi.fn(async () => {}),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
import { POST } from "@/app/api/mcp/route";
import { POST as PUBLIC_POST } from "@/app/api/mcp/public/route";
import { db } from "@/lib/db";
import { revokeApiKey } from "@/lib/mcp/auth/api-keys";
import { hashSecret } from "@/lib/mcp/auth/secrets";
import { rememberTwin } from "@/lib/memory";
import { storeActivities } from "@/lib/twin/data";
import { isPublished, publishTwin } from "@/lib/twin/publish";
import { connectMcp, MCP_TEST_URL, resultText } from "@/tests/support/mcp";
import { accessTokenFor, apiKeyFor } from "@/tests/support/mcp-auth";
import { leg, MEME, SUI, swap } from "@/tests/support/sui";

const OWNER = `0x${"c3".repeat(32)}`;
const DEMO = `0x${"d4".repeat(32)}`;
const T0 = Date.parse("2026-10-01T10:00:00Z");
const HOUR = 3_600_000;

async function seedTwin(address: string): Promise<void> {
  await storeActivities(address, [
    swap(T0, leg(SUI, 100, 100), leg(MEME, 1000, null)),
    swap(T0 + HOUR, leg(MEME, 1000, null), leg(SUI, 120, 120)),
    swap(T0 + 2 * HOUR, leg(SUI, 50, 50), leg(MEME, 400, null)),
  ]);
  await db.syncState.create({ data: { address, lastSyncedAt: new Date() } });
  await rememberTwin(address, [
    { type: "insight", key: "insight:auth:0", text: "(as of 2026-10-24) Panic-sells MEME dips." },
    { type: "chat", key: "chat:auth", text: 'Owner said: "I am saving for a house."' },
  ]);
}

function postMcp(token?: string, body: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list" }): Promise<Response> {
  return POST(
    new Request(MCP_TEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("authenticated MCP endpoint", () => {
  beforeAll(async () => {
    await seedTwin(OWNER);
    await seedTwin(DEMO);
    await publishTwin(DEMO);
  });

  test("without a token it answers 401 pointing at the protected resource metadata", async () => {
    const response = await postMcp();
    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain("Bearer");
    expect(challenge).toContain('resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"');
    expect(response.headers.get("access-control-expose-headers")).toContain("WWW-Authenticate");
  });

  test("rejects unknown, revoked and expired credentials", async () => {
    expect((await postMcp("wt_key_not-a-real-key")).status).toBe(401);
    const key = await apiKeyFor(OWNER);
    const [row] = await db.apiKey.findMany({ where: { keyHash: hashSecret(key) } });
    await revokeApiKey(OWNER, row.id);
    expect((await postMcp(key)).status).toBe(401);

    const expired = await apiKeyFor(OWNER);
    await db.apiKey.update({ where: { keyHash: hashSecret(expired) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await postMcp(expired)).status).toBe(401);
  });

  test("an access token minted for another resource is refused", async () => {
    const { token } = await accessTokenFor(OWNER, { resource: "https://evil.example/api/mcp" });
    expect((await postMcp(token)).status).toBe(401);
  });

  test("tools are filtered by scope", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:read"]) });
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["whoami", "get_my_stats", "recall_my_memories", "list_my_trades", "get_leaderboard"]));
    expect(names).not.toContain("ask_my_twin");
    expect(names).not.toContain("start_sync");
    expect(names).not.toContain("set_published");
    expect(names).not.toContain("follow_twin");
    expect((await client.listPrompts()).prompts.map((prompt) => prompt.name)).toContain("roast_my_trading");
  });

  test("whoami and get_my_stats act for the key's wallet", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:read"]) });
    const who = await client.callTool({ name: "whoami", arguments: {} });
    expect(who.structuredContent).toMatchObject({ address: OWNER, demo: false, connection: "api_key", synced: true });
    const stats = await client.callTool({ name: "get_my_stats", arguments: {} });
    expect(stats.isError).toBeFalsy();
    expect(stats.structuredContent).toMatchObject({ address: OWNER, stats: { swaps: 3, realizedPnlUsd: 20 } });
  });

  test("recall_my_memories reaches the owner's private memories", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:read"]) });
    const result = await client.callTool({ name: "recall_my_memories", arguments: { query: "house", types: ["chat"] } });
    expect(resultText(result)).toContain("saving for a house");
  });

  test("list_my_trades pages newest first", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:read"]) });
    const first = await client.callTool({ name: "list_my_trades", arguments: { limit: 2 } });
    const page1 = first.structuredContent as { activities: { at: string }[]; nextCursor: string | null };
    expect(page1.activities).toHaveLength(2);
    expect(page1.activities[0].at > page1.activities[1].at).toBe(true);
    expect(page1.nextCursor).not.toBeNull();
    const second = await client.callTool({ name: "list_my_trades", arguments: { limit: 2, cursor: page1.nextCursor } });
    const page2 = second.structuredContent as { activities: { at: string }[]; nextCursor: string | null };
    expect(page2.activities).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    const bad = await client.callTool({ name: "list_my_trades", arguments: { cursor: "garbage" } });
    expect(bad.isError).toBe(true);
  });

  test("remember_fact saves once, and is refused for demo grants", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:remember"]) });
    const first = await client.callTool({ name: "remember_fact", arguments: { fact: "I only trade on weekends." } });
    expect(first.structuredContent).toMatchObject({ saved: true, alreadyKnown: false });
    const again = await client.callTool({ name: "remember_fact", arguments: { fact: "I only trade on weekends." } });
    expect(again.structuredContent).toMatchObject({ saved: false, alreadyKnown: true });

    const demo = await connectMcp(POST, { token: (await accessTokenFor(DEMO, { demo: true })).token });
    const refused = await demo.callTool({ name: "remember_fact", arguments: { fact: "I like turtles a lot." } });
    expect(refused.isError).toBe(true);
  });

  test("set_published publishes and unpublishes; demo grants can't unpublish", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:publish"]) });
    const published = await client.callTool({ name: "set_published", arguments: { published: true } });
    expect(published.structuredContent).toMatchObject({ published: true });
    const visitor = await connectMcp(PUBLIC_POST);
    expect((await visitor.callTool({ name: "get_public_twin", arguments: { address: OWNER } })).isError).toBeFalsy();

    await client.callTool({ name: "set_published", arguments: { published: false } });
    expect((await visitor.callTool({ name: "get_public_twin", arguments: { address: OWNER } })).isError).toBe(true);

    const demo = await connectMcp(POST, { token: (await accessTokenFor(DEMO, { demo: true })).token });
    const refused = await demo.callTool({ name: "set_published", arguments: { published: false } });
    expect(refused.isError).toBe(true);
    expect(resultText(refused)).toContain("Demo twins stay public");
    expect(await isPublished(DEMO)).toBe(true);
  });

  test("revoking an OAuth grant cuts its access tokens off", async () => {
    const { token, grantId } = await accessTokenFor(OWNER, { scopes: ["twin:read"] });
    expect((await postMcp(token)).status).toBe(200);
    await db.oAuthGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
    expect((await postMcp(token)).status).toBe(401);
  });

  test("start_sync starts one run and reports a run already in flight", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["twin:sync", "twin:read"]) });
    const first = await client.callTool({ name: "start_sync", arguments: {} });
    expect(first.structuredContent).toMatchObject({ alreadyRunning: false });
    const second = await client.callTool({ name: "start_sync", arguments: {} });
    expect(second.structuredContent).toMatchObject({ alreadyRunning: true });
    const status = await client.callTool({ name: "get_sync_status", arguments: {} });
    expect(status.structuredContent).toMatchObject({ run: { status: "running" } });
  });

  test("follow_twin explains the rules it breaks", async () => {
    const client = await connectMcp(POST, { token: await apiKeyFor(OWNER, ["copy:trade"]) });
    const self = await client.callTool({ name: "follow_twin", arguments: { leader: OWNER } });
    expect(self.isError).toBe(true);
    expect(resultText(self)).toContain("own twin");
    // Without twin:read the portfolio tool isn't even listed.
    await expect(client.callTool({ name: "get_paper_portfolio", arguments: {} })).rejects.toThrow("not found");
  });
});
