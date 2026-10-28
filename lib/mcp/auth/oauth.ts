import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import type { Session } from "@/lib/auth/token";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ClientError, isRedirectAllowed, type OAuthClientInfo, resolveClient } from "@/lib/mcp/auth/clients";
import { hashSecret, newSecret, S256_CHALLENGE, verifyPkce } from "@/lib/mcp/auth/secrets";
import { mcpResourceUrl } from "@/lib/mcp/auth/urls";
import { DEFAULT_SCOPES, formatScopes, type McpScope, parseScopes } from "@/lib/mcp/scopes";

export const ACCESS_TOKEN_TTL_S = 60 * 60;
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;
const CODE_TTL_MS = 60_000;
const CONSENT_TTL_S = 10 * 60;
const CONSENT_AUDIENCE = "wallettwin:oauth-consent";

/** An RFC 6749 error, returned as `{ error, error_description }`. */
export class OAuthFlowError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type" | "invalid_scope" | "invalid_target",
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OAuthFlowError";
  }
}

// ── /authorize ─────────────────────────────────────────────────────────────

export interface AuthorizeRequest {
  clientId: string;
  clientName: string;
  clientUri: string | null;
  logoUri: string | null;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scopes: McpScope[];
  resource: string;
}

/**
 * Outcome of validating /authorize parameters. Until the client and redirect URI are verified,
 * errors are shown on our page and never redirected (an open redirector otherwise).
 */
export type AuthorizeValidation =
  | { ok: true; request: AuthorizeRequest }
  | { ok: false; error: string; redirectTo: string | null };

const authorizeParams = z.object({
  response_type: z.string().optional(),
  client_id: z.string().min(1).max(2000),
  redirect_uri: z.string().min(1).max(2000),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
  state: z.string().max(1000).optional(),
  scope: z.string().max(1000).optional(),
  resource: z.string().max(2000).optional(),
});

function errorRedirect(redirectUri: string, error: string, description: string, state: string | undefined, issuer: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  url.searchParams.set("iss", issuer);
  return url.toString();
}

export async function validateAuthorizeRequest(
  params: Record<string, string | undefined>,
  origin: string,
  options: { fetcher?: (url: string) => Promise<unknown> } = {},
): Promise<AuthorizeValidation> {
  const parsed = authorizeParams.safeParse(params);
  if (!parsed.success) return { ok: false, error: "This sign-in link is missing its client_id or redirect_uri.", redirectTo: null };
  const query = parsed.data;

  let client: OAuthClientInfo;
  try {
    client = await resolveClient(query.client_id, { fetcher: options.fetcher });
  } catch (error: unknown) {
    const message = error instanceof ClientError ? error.message : "We couldn't identify the app asking for access.";
    return { ok: false, error: message, redirectTo: null };
  }
  if (!isRedirectAllowed(client.redirectUris, query.redirect_uri)) {
    return { ok: false, error: `${client.name} asked to send you somewhere it never registered.`, redirectTo: null };
  }

  // From here on the redirect URI is trusted, so protocol errors go back to the client.
  const fail = (error: string, description: string): AuthorizeValidation => ({
    ok: false,
    error: description,
    redirectTo: errorRedirect(query.redirect_uri, error, description, query.state, origin),
  });
  if (query.response_type !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.");
  if (query.code_challenge_method !== "S256" || !query.code_challenge || !S256_CHALLENGE.test(query.code_challenge)) {
    return fail("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const expectedResource = mcpResourceUrl(origin);
  if (query.resource && query.resource.replace(/\/$/, "") !== expectedResource) {
    return fail("invalid_target", `This server only issues tokens for ${expectedResource}.`);
  }
  const requested = query.scope ? parseScopes(query.scope) : [...DEFAULT_SCOPES];
  if (requested.length === 0) return fail("invalid_scope", "None of the requested scopes exist on WalletTwin.");

  return {
    ok: true,
    request: {
      clientId: client.id,
      clientName: client.name,
      clientUri: client.clientUri,
      logoUri: client.logoUri,
      redirectUri: query.redirect_uri,
      state: query.state ?? null,
      codeChallenge: query.code_challenge,
      scopes: requested,
      resource: expectedResource,
    },
  };
}

const consentKey = () => new TextEncoder().encode(env().SESSION_SECRET);

/** Seals the validated request into the consent form, so the POST can't change client, redirect or PKCE. */
export async function sealConsent(request: AuthorizeRequest): Promise<string> {
  return new SignJWT({ req: request })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CONSENT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CONSENT_TTL_S}s`)
    .sign(consentKey());
}

export async function openConsent(sealed: string): Promise<AuthorizeRequest | null> {
  try {
    const { payload } = await jwtVerify(sealed, consentKey(), { audience: CONSENT_AUDIENCE, algorithms: ["HS256"] });
    return (payload.req as AuthorizeRequest | undefined) ?? null;
  } catch {
    return null;
  }
}

/** The user approved: record the grant (one per wallet and client) and mint a single-use code. */
export async function approveConsent(
  request: AuthorizeRequest,
  session: Session,
  chosenScopes: readonly McpScope[],
  origin: string,
): Promise<string> {
  const scopes = request.scopes.filter((scope) => chosenScopes.includes(scope));
  if (scopes.length === 0) return denyConsent(request, origin);

  const existing = await db.oAuthGrant.findFirst({
    where: { clientId: request.clientId, address: session.address, revokedAt: null },
  });
  const grant = existing
    ? await db.oAuthGrant.update({
        where: { id: existing.id },
        data: { scopes: formatScopes(scopes), clientName: request.clientName, demo: Boolean(session.demo) },
      })
    : await db.oAuthGrant.create({
        data: {
          clientId: request.clientId,
          clientName: request.clientName,
          address: session.address,
          demo: Boolean(session.demo),
          scopes: formatScopes(scopes),
        },
      });

  const code = newSecret("code");
  await db.oAuthCode.create({
    data: {
      codeHash: hashSecret(code),
      grantId: grant.id,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      resource: request.resource,
      scopes: formatScopes(scopes),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  const url = new URL(request.redirectUri);
  url.searchParams.set("code", code);
  if (request.state) url.searchParams.set("state", request.state);
  // RFC 9207: lets the client confirm which authorization server answered.
  url.searchParams.set("iss", origin);
  return url.toString();
}

export function denyConsent(request: AuthorizeRequest, origin: string): string {
  return errorRedirect(request.redirectUri, "access_denied", "The wallet owner declined.", request.state ?? undefined, origin);
}

// ── /token ─────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

async function issueTokens(grantId: string, scopes: string, resource: string, now: Date): Promise<TokenResponse> {
  const accessToken = newSecret("access");
  const refreshToken = newSecret("refresh");
  await db.oAuthToken.createMany({
    data: [
      {
        tokenHash: hashSecret(accessToken),
        kind: "access",
        grantId,
        scopes,
        resource,
        expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_S * 1000),
      },
      {
        tokenHash: hashSecret(refreshToken),
        kind: "refresh",
        grantId,
        scopes,
        resource,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_S * 1000),
      },
    ],
  });
  return { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refreshToken, scope: scopes };
}

/** Revokes a grant and every token it ever issued (disconnect, or a detected replay). */
export async function revokeGrantById(grantId: string, now: Date = new Date()): Promise<void> {
  await db.$transaction([
    db.oAuthGrant.updateMany({ where: { id: grantId, revokedAt: null }, data: { revokedAt: now } }),
    db.oAuthToken.updateMany({ where: { grantId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
}

async function activeGrant(grantId: string, clientId: string) {
  const grant = await db.oAuthGrant.findUnique({ where: { id: grantId } });
  if (!grant || grant.revokedAt) throw new OAuthFlowError("invalid_grant", "This connection was revoked. Connect again.");
  if (grant.clientId !== clientId) throw new OAuthFlowError("invalid_grant", "This grant belongs to another client.");
  return grant;
}

export async function exchangeCode(
  input: { code: string; codeVerifier: string; clientId: string; redirectUri: string; resource?: string },
  origin: string,
  now: Date = new Date(),
): Promise<TokenResponse> {
  const row = await db.oAuthCode.findUnique({ where: { codeHash: hashSecret(input.code) } });
  if (!row) throw new OAuthFlowError("invalid_grant", "Unknown authorization code.");
  if (row.usedAt) {
    // RFC 6749 §4.1.2: a replayed code means it leaked, so everything it issued is revoked.
    await revokeGrantById(row.grantId, now);
    throw new OAuthFlowError("invalid_grant", "This authorization code was already used.");
  }
  const claimed = await db.oAuthCode.updateMany({ where: { codeHash: row.codeHash, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new OAuthFlowError("invalid_grant", "This authorization code was already used.");
  if (row.expiresAt <= now) throw new OAuthFlowError("invalid_grant", "This authorization code expired.");
  if (row.clientId !== input.clientId) throw new OAuthFlowError("invalid_grant", "This code was issued to another client.");
  if (row.redirectUri !== input.redirectUri) throw new OAuthFlowError("invalid_grant", "redirect_uri doesn't match the authorization request.");
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) throw new OAuthFlowError("invalid_grant", "PKCE verification failed.");
  if (input.resource && input.resource.replace(/\/$/, "") !== row.resource) {
    throw new OAuthFlowError("invalid_target", "resource doesn't match the authorization request.");
  }
  if (row.resource !== mcpResourceUrl(origin)) throw new OAuthFlowError("invalid_target", "This code was issued for another server.");
  await activeGrant(row.grantId, input.clientId);
  return issueTokens(row.grantId, row.scopes, row.resource, now);
}

export async function refreshTokens(
  input: { refreshToken: string; clientId: string; scope?: string },
  now: Date = new Date(),
): Promise<TokenResponse> {
  const row = await db.oAuthToken.findUnique({ where: { tokenHash: hashSecret(input.refreshToken) } });
  if (!row || row.kind !== "refresh") throw new OAuthFlowError("invalid_grant", "Unknown refresh token.");
  if (row.rotatedAt) {
    // Refresh tokens are single-use: seeing one twice means it was stolen. Cut the whole grant off.
    await revokeGrantById(row.grantId, now);
    throw new OAuthFlowError("invalid_grant", "This refresh token was already used. Connect again.");
  }
  if (row.revokedAt || row.expiresAt <= now) throw new OAuthFlowError("invalid_grant", "This refresh token expired. Connect again.");
  const grant = await activeGrant(row.grantId, input.clientId);

  // Refreshing may narrow scopes, never widen them past what the grant still allows.
  const allowed = parseScopes(row.scopes).filter((scope) => parseScopes(grant.scopes).includes(scope));
  const scopes = input.scope ? parseScopes(input.scope) : allowed;
  if (scopes.length === 0 || scopes.some((scope) => !allowed.includes(scope))) {
    throw new OAuthFlowError("invalid_scope", "You can only keep or narrow the scopes you were granted.");
  }

  const rotated = await db.oAuthToken.updateMany({
    where: { tokenHash: row.tokenHash, rotatedAt: null },
    data: { rotatedAt: now, revokedAt: now },
  });
  if (rotated.count !== 1) {
    await revokeGrantById(row.grantId, now);
    throw new OAuthFlowError("invalid_grant", "This refresh token was already used. Connect again.");
  }
  return issueTokens(row.grantId, formatScopes(scopes), row.resource, now);
}

/**
 * RFC 7009. Revoking a refresh token disconnects the client; an access token dies alone.
 * Unknown tokens are not an error.
 */
export async function revokeToken(token: string, now: Date = new Date()): Promise<void> {
  const row = await db.oAuthToken.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (!row) return;
  if (row.kind === "refresh") {
    await revokeGrantById(row.grantId, now);
    return;
  }
  await db.oAuthToken.updateMany({ where: { tokenHash: row.tokenHash, revokedAt: null }, data: { revokedAt: now } });
}

// ── Connected apps (the /connect page) ─────────────────────────────────────

export interface GrantView {
  id: string;
  clientId: string;
  clientName: string;
  scopes: McpScope[];
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listGrants(address: string): Promise<GrantView[]> {
  const rows = await db.oAuthGrant.findMany({ where: { address, revokedAt: null }, orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }));
}

/** Revokes one of the wallet's connected apps; false when it isn't theirs or is already revoked. */
export async function revokeGrant(address: string, grantId: string): Promise<boolean> {
  const grant = await db.oAuthGrant.findFirst({ where: { id: grantId, address, revokedAt: null } });
  if (!grant) return false;
  await revokeGrantById(grant.id);
  return true;
}
