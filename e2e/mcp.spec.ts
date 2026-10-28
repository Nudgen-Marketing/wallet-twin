import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { expect, SCALPER, signInWithBurner, test } from "./fixtures";

const MCP_HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const CALLBACK = "http://127.0.0.1:8976/callback";

interface RpcResult {
  result?: { tools?: { name: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
  error?: { message: string };
}

/** One stateless JSON-RPC call; answers arrive as a single SSE `data:` line or plain JSON. */
async function rpc(
  request: APIRequestContext,
  path: string,
  method: string,
  params: Record<string, unknown> = {},
  token?: string,
): Promise<{ status: number; body: RpcResult | null; challenge: string | null }> {
  const response = await request.post(path, {
    headers: { ...MCP_HEADERS, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const text = await response.text();
  const json = text.startsWith("{") ? text : text.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
  return {
    status: response.status(),
    body: json ? (JSON.parse(json) as RpcResult) : null,
    challenge: response.headers()["www-authenticate"] ?? null,
  };
}

const toolNames = (body: RpcResult | null) => (body?.result?.tools ?? []).map((tool) => tool.name);

test.describe("MCP server", () => {
  test("the public endpoint serves published twins without sign-in", async ({ request }) => {
    const list = await rpc(request, "/api/mcp/public", "tools/list");
    expect(toolNames(list.body).sort()).toEqual(["ask_public_twin", "get_leaderboard", "get_public_twin", "list_demo_twins"]);

    const twin = await rpc(request, "/api/mcp/public", "tools/call", { name: "get_public_twin", arguments: { address: SCALPER } });
    expect(twin.body?.result?.structuredContent).toMatchObject({ address: SCALPER });
    expect(JSON.stringify(twin.body)).not.toContain("E2E-PRIVATE-FACT");
  });

  test("the private endpoint challenges unauthenticated clients toward OAuth", async ({ request }) => {
    const denied = await rpc(request, "/api/mcp", "tools/list");
    expect(denied.status).toBe(401);
    expect(denied.challenge).toContain("resource_metadata=");

    const metadata = await (await request.get("/.well-known/oauth-protected-resource/api/mcp")).json();
    expect(metadata.resource).toMatch(/\/api\/mcp$/);
    const server = await (await request.get("/.well-known/oauth-authorization-server")).json();
    expect(server.code_challenge_methods_supported).toEqual(["S256"]);
  });

  test("an API key from the Agents page acts for the signed-in wallet until revoked", async ({ page, request }) => {
    await signInWithBurner(page);
    await page.goto("/connect");
    await expect(page.getByRole("heading", { name: "Plug your twin into any AI agent" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Claude Code" })).toBeVisible();

    await page.getByLabel("Name").fill("e2e agent");
    await page.getByRole("button", { name: "Create key" }).click();
    const secret = (await page.getByRole("status").locator("code").innerText()).trim();
    expect(secret).toMatch(/^wt_key_/);

    const who = await rpc(request, "/api/mcp", "tools/call", { name: "whoami", arguments: {} }, secret);
    expect(who.body?.result?.structuredContent).toMatchObject({ connection: "api_key", demo: false });

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("No active keys.")).toBeVisible();
    expect((await rpc(request, "/api/mcp", "tools/list", {}, secret)).status).toBe(401);
  });

  test("OAuth: register, consent with a narrowed scope, exchange the code, call tools", async ({ page, request }) => {
    const registered = await (
      await request.post("/api/oauth/register", { data: { client_name: "E2E Agent", redirect_uris: [CALLBACK] } })
    ).json();
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URLSearchParams({
      response_type: "code",
      client_id: registered.client_id,
      redirect_uri: CALLBACK,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "e2e-state",
      scope: "twin:read twin:chat twin:publish",
    });

    // The client's callback isn't running: capture where the browser is sent instead.
    let callbackUrl: URL | null = null;
    await page.route(`${CALLBACK}**`, async (route) => {
      callbackUrl = new URL(route.request().url());
      await route.fulfill({ body: "ok" });
    });

    await page.goto(`/oauth/authorize?${authorize}`);
    await expect(page.getByText("Unverified app")).toBeVisible();
    await page.getByRole("button", { name: "Use The MAGMA scalper" }).click();
    await expect(page.getByRole("heading", { name: "Let an unverified app use your twin?" })).toBeVisible();
    await page.getByRole("checkbox", { name: /Publish or unpublish/ }).uncheck();
    await page.getByRole("button", { name: "Allow" }).click();
    await expect.poll(() => callbackUrl?.searchParams.get("state")).toBe("e2e-state");

    const tokens = await (
      await request.post("/api/oauth/token", {
        form: {
          grant_type: "authorization_code",
          client_id: registered.client_id,
          code: callbackUrl!.searchParams.get("code") ?? "",
          code_verifier: verifier,
          redirect_uri: CALLBACK,
        },
      })
    ).json();
    expect(tokens.scope).toBe("twin:read twin:chat");

    const list = await rpc(request, "/api/mcp", "tools/list", {}, tokens.access_token);
    expect(toolNames(list.body)).toContain("get_my_stats");
    expect(toolNames(list.body)).not.toContain("set_published");
    const who = await rpc(request, "/api/mcp", "tools/call", { name: "whoami", arguments: {} }, tokens.access_token);
    expect(who.body?.result?.structuredContent).toMatchObject({ address: SCALPER, demo: true, connection: "oauth" });
  });

  test("a bad authorization request shows an error instead of redirecting", async ({ page }) => {
    await page.goto(`/oauth/authorize?client_id=wtc_unknown&redirect_uri=${encodeURIComponent(CALLBACK)}`);
    await expect(page.getByRole("heading", { name: "Can't connect this app" })).toBeVisible();
    await expect(page).toHaveURL(/\/oauth\/authorize/);
  });
});
