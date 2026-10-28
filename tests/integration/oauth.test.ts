import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/copy/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/copy/service")>()),
  backtestCopyReturnPct: async () => null,
}));
import { GET as protectedResource } from "@/app/.well-known/oauth-protected-resource/[[...path]]/route";
import { GET as serverMetadata } from "@/app/.well-known/oauth-authorization-server/route";
import { POST as mcp } from "@/app/api/mcp/route";
import { POST as register } from "@/app/api/oauth/register/route";
import { POST as revoke } from "@/app/api/oauth/revoke/route";
import { POST as token } from "@/app/api/oauth/token/route";
import { db } from "@/lib/db";
import { approveConsent, type AuthorizeRequest, validateAuthorizeRequest } from "@/lib/mcp/auth/oauth";
import { pkceChallenge, SECRET_PREFIX } from "@/lib/mcp/auth/secrets";
import { connectMcp } from "@/tests/support/mcp";
import type { NextRequest } from "next/server";

const ORIGIN = "http://localhost:3000";
const ADDRESS = `0x${"e5".repeat(32)}`;
const REDIRECT = "https://agent.example/callback";
const VERIFIER = "a".repeat(20) + "-._~" + "b".repeat(30);

function form(path: string, body: Record<string, string>): NextRequest {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  }) as NextRequest;
}

async function registerClient(): Promise<string> {
  const response = await register(
    new Request(`${ORIGIN}/api/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Agent X", redirect_uris: [REDIRECT] }),
    }) as NextRequest,
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as { client_id: string; token_endpoint_auth_method: string };
  expect(body.token_endpoint_auth_method).toBe("none");
  return body.client_id;
}

async function authorize(clientId: string, extra: Record<string, string> = {}): Promise<AuthorizeRequest> {
  const validation = await validateAuthorizeRequest(
    {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
      state: "xyz",
      resource: `${ORIGIN}/api/mcp`,
      ...extra,
    },
    ORIGIN,
  );
  if (!validation.ok) throw new Error(validation.error);
  return validation.request;
}

async function codeFor(clientId: string, scopes = ["twin:read", "twin:chat"] as const): Promise<string> {
  const request = await authorize(clientId, { scope: "twin:read twin:chat twin:publish" });
  const redirect = new URL(await approveConsent(request, { address: ADDRESS }, scopes, ORIGIN));
  expect(redirect.origin + redirect.pathname).toBe(REDIRECT);
  expect(redirect.searchParams.get("state")).toBe("xyz");
  expect(redirect.searchParams.get("iss")).toBe(ORIGIN);
  return redirect.searchParams.get("code") ?? "";
}

async function exchange(clientId: string, code: string, verifier = VERIFIER) {
  const response = await token(
    form("/api/oauth/token", { grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: REDIRECT }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

async function refresh(clientId: string, refreshToken: string) {
  const response = await token(form("/api/oauth/token", { grant_type: "refresh_token", client_id: clientId, refresh_token: refreshToken }));
  return { status: response.status, body: (await response.json()) as Record<string, string> };
}

describe("OAuth metadata", () => {
  test("advertises PKCE S256, public clients, CIMD and DCR", async () => {
    const body = (await (await serverMetadata(new Request(`${ORIGIN}/.well-known/oauth-authorization-server`))).json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      client_id_metadata_document_supported: true,
    });
  });

  test("protected resource metadata names the MCP endpoint and this issuer", async () => {
    const response = await protectedResource(new Request(`${ORIGIN}/.well-known/oauth-protected-resource/api/mcp`), {
      params: Promise.resolve({ path: ["api", "mcp"] }),
    });
    expect(await response.json()).toMatchObject({ resource: `${ORIGIN}/api/mcp`, authorization_servers: [ORIGIN] });
    const other = await protectedResource(new Request(`${ORIGIN}/.well-known/oauth-protected-resource/nope`), {
      params: Promise.resolve({ path: ["nope"] }),
    });
    expect(other.status).toBe(404);
  });
});

describe("authorization request validation", () => {
  test("never redirects to an unregistered redirect_uri", async () => {
    const clientId = await registerClient();
    const validation = await validateAuthorizeRequest(
      { response_type: "code", client_id: clientId, redirect_uri: "https://evil.example/steal", code_challenge: pkceChallenge(VERIFIER), code_challenge_method: "S256" },
      ORIGIN,
    );
    expect(validation).toMatchObject({ ok: false, redirectTo: null });
  });

  test("unknown clients are shown an error, not redirected", async () => {
    const validation = await validateAuthorizeRequest({ client_id: "wtc_unknown", redirect_uri: REDIRECT }, ORIGIN);
    expect(validation).toMatchObject({ ok: false, redirectTo: null });
  });

  test("missing PKCE or a foreign resource goes back to the client as an error", async () => {
    const clientId = await registerClient();
    const noPkce = await validateAuthorizeRequest({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT, state: "s" }, ORIGIN);
    expect(noPkce.ok).toBe(false);
    const target = new URL((noPkce as { redirectTo: string }).redirectTo);
    expect(target.searchParams.get("error")).toBe("invalid_request");
    expect(target.searchParams.get("state")).toBe("s");

    const foreign = await validateAuthorizeRequest(
      { response_type: "code", client_id: clientId, redirect_uri: REDIRECT, code_challenge: pkceChallenge(VERIFIER), code_challenge_method: "S256", resource: "https://other.example/mcp" },
      ORIGIN,
    );
    expect(new URL((foreign as { redirectTo: string }).redirectTo).searchParams.get("error")).toBe("invalid_target");
  });

  test("defaults to every scope except publishing", async () => {
    const request = await authorize(await registerClient());
    expect(request.scopes).not.toContain("twin:publish");
    expect(request.scopes).toContain("twin:read");
  });

  test("CIMD clients are fetched and checked against their own URL", async () => {
    const clientId = "https://agent.example/oauth/client.json";
    const fetcher = vi.fn(async () => ({ client_id: clientId, client_name: "CIMD Agent", redirect_uris: [REDIRECT] }));
    const params = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: pkceChallenge(VERIFIER),
      code_challenge_method: "S256",
    };
    const validation = await validateAuthorizeRequest(params, ORIGIN, { fetcher });
    expect(validation).toMatchObject({ ok: true, request: { clientName: "CIMD Agent" } });
    // Cached for a day: a second authorization doesn't refetch.
    await validateAuthorizeRequest(params, ORIGIN, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("authorization code and refresh flow", () => {
  test("code → tokens → MCP call → refresh rotation", async () => {
    const clientId = await registerClient();
    const code = await codeFor(clientId);
    const { status, body } = await exchange(clientId, code);
    expect(status).toBe(200);
    expect(body).toMatchObject({ token_type: "Bearer", scope: "twin:read twin:chat" });
    expect(body.access_token).toMatch(/^wt_at_/);
    expect(body.refresh_token).toMatch(/^wt_rt_/);

    const client = await connectMcp(mcp, { token: body.access_token });
    const who = await client.callTool({ name: "whoami", arguments: {} });
    expect(who.structuredContent).toMatchObject({ address: ADDRESS, connection: "oauth", scopes: ["twin:read", "twin:chat"] });
    // Publishing was requested but not approved.
    expect((await client.listTools()).tools.map((tool) => tool.name)).not.toContain("set_published");

    const rotated = await refresh(clientId, body.refresh_token);
    expect(rotated.status).toBe(200);
    expect(rotated.body.refresh_token).not.toBe(body.refresh_token);
    expect((await connectMcp(mcp, { token: rotated.body.access_token })).getServerVersion()?.name).toBe("wallettwin");
  });

  test("a replayed refresh token revokes the whole grant", async () => {
    const clientId = await registerClient();
    const { body } = await exchange(clientId, await codeFor(clientId));
    const rotated = await refresh(clientId, body.refresh_token);
    const replay = await refresh(clientId, body.refresh_token);
    expect(replay).toMatchObject({ status: 400, body: { error: "invalid_grant" } });
    expect((await refresh(clientId, rotated.body.refresh_token)).status).toBe(400);
    await expect(connectMcp(mcp, { token: rotated.body.access_token })).rejects.toThrow();
  });

  test("codes are single-use, PKCE-bound and client-bound", async () => {
    const clientId = await registerClient();
    const wrongVerifier = await exchange(clientId, await codeFor(clientId), "z".repeat(50));
    expect(wrongVerifier).toMatchObject({ status: 400, body: { error: "invalid_grant" } });

    const code = await codeFor(clientId);
    const otherClient = await registerClient();
    expect((await exchange(otherClient, code)).status).toBe(400);

    const fresh = await codeFor(clientId);
    const first = await exchange(clientId, fresh);
    expect(first.status).toBe(200);
    expect((await exchange(clientId, fresh)).body.error).toBe("invalid_grant");
    // The replay revoked what the first exchange issued.
    await expect(connectMcp(mcp, { token: first.body.access_token })).rejects.toThrow();
  });

  test("expired codes are refused", async () => {
    const clientId = await registerClient();
    const code = await codeFor(clientId);
    await db.oAuthCode.updateMany({ where: { clientId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await exchange(clientId, code)).body.error).toBe("invalid_grant");
  });

  test("revoking a refresh token disconnects the client", async () => {
    const clientId = await registerClient();
    const { body } = await exchange(clientId, await codeFor(clientId));
    const response = await revoke(form("/api/oauth/revoke", { token: body.refresh_token }));
    expect(response.status).toBe(200);
    await expect(connectMcp(mcp, { token: body.access_token })).rejects.toThrow();
    const unknown = `${SECRET_PREFIX.refresh}unknown`;
    expect((await revoke(form("/api/oauth/revoke", { token: unknown }))).status).toBe(200);
  });

  test("unsupported grant types and missing client ids are rejected", async () => {
    expect((await token(form("/api/oauth/token", { grant_type: "password", client_id: "x" }))).status).toBe(400);
    expect((await token(form("/api/oauth/token", { grant_type: "authorization_code" }))).status).toBe(401);
  });

  test("DCR refuses unsafe redirect URIs", async () => {
    const response = await register(
      new Request(`${ORIGIN}/api/oauth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ redirect_uris: ["http://evil.example/cb"] }),
      }) as NextRequest,
    );
    expect(response.status).toBe(400);
  });
});
