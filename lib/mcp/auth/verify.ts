import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { db } from "@/lib/db";
import { hashSecret, secretKind } from "@/lib/mcp/auth/secrets";
import { mcpResourceUrl, publicOrigin } from "@/lib/mcp/auth/urls";
import type { McpPrincipal } from "@/lib/mcp/principal";
import { parseScopes } from "@/lib/mcp/scopes";

/** lastUsedAt is display-only, so it's written at most once a minute per credential. */
const TOUCH_EVERY_MS = 60_000;

function touchBefore(now: Date) {
  return { OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - TOUCH_EVERY_MS) } }] };
}

async function principalForApiKey(key: string, now: Date): Promise<McpPrincipal | null> {
  const row = await db.apiKey.findUnique({ where: { keyHash: hashSecret(key) } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= now)) return null;
  await db.apiKey.updateMany({ where: { id: row.id, ...touchBefore(now) }, data: { lastUsedAt: now } });
  return { kind: "api_key", id: `key:${row.id}`, address: row.address, demo: false, scopes: parseScopes(row.scopes) };
}

async function principalForAccessToken(token: string, resource: string, now: Date): Promise<McpPrincipal | null> {
  const row = await db.oAuthToken.findUnique({ where: { tokenHash: hashSecret(token) } });
  // Audience check (RFC 8707): a token minted for another resource is useless here.
  if (!row || row.kind !== "access" || row.revokedAt || row.expiresAt <= now || row.resource !== resource) return null;
  const grant = await db.oAuthGrant.findUnique({ where: { id: row.grantId } });
  if (!grant || grant.revokedAt) return null;
  await db.oAuthGrant.updateMany({ where: { id: grant.id, ...touchBefore(now) }, data: { lastUsedAt: now } });
  return {
    kind: "oauth",
    id: `grant:${grant.id}`,
    address: grant.address,
    demo: grant.demo,
    scopes: parseScopes(row.scopes),
  };
}

/** Resolves an access token or API key to the wallet it acts for, or null for anything invalid. */
export async function principalForToken(
  token: string,
  resource: string,
  now: Date = new Date(),
): Promise<McpPrincipal | null> {
  const kind = secretKind(token);
  if (kind === "apiKey") return principalForApiKey(token, now);
  if (kind === "access") return principalForAccessToken(token, resource, now);
  return null;
}

/** `verifyToken` for mcp-handler's withMcpAuth: the principal travels in AuthInfo.extra. */
export async function verifyBearer(request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  const principal = await principalForToken(bearerToken, mcpResourceUrl(publicOrigin(request)));
  if (!principal) return undefined;
  return { token: bearerToken, clientId: principal.id, scopes: [...principal.scopes], extra: { principal } };
}

export function principalFromAuth(auth: AuthInfo | undefined): McpPrincipal | null {
  const principal = auth?.extra?.principal;
  return principal && typeof principal === "object" ? (principal as McpPrincipal) : null;
}
