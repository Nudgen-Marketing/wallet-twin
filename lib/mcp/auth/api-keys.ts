import "server-only";
import { db } from "@/lib/db";
import { hashSecret, newSecret, SECRET_PREFIX } from "@/lib/mcp/auth/secrets";
import { formatScopes, type McpScope, parseScopes } from "@/lib/mcp/scopes";

export const MAX_ACTIVE_KEYS = 10;
const DAY_MS = 86_400_000;

export interface ApiKeyView {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: McpScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export class ApiKeyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiKeyError";
  }
}

function view(row: {
  id: string;
  name: string;
  displayPrefix: string;
  scopes: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
}): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    displayPrefix: row.displayPrefix,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

const activeWhere = (address: string, now: Date) => ({
  address,
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

/** Creates a key and returns its secret exactly once. */
export async function createApiKey(input: {
  address: string;
  name: string;
  scopes: readonly McpScope[];
  expiresInDays: number | null;
  now?: Date;
}): Promise<{ key: string; apiKey: ApiKeyView }> {
  const now = input.now ?? new Date();
  if (input.scopes.length === 0) throw new ApiKeyError("Pick at least one permission.", 400);
  if ((await db.apiKey.count({ where: activeWhere(input.address, now) })) >= MAX_ACTIVE_KEYS) {
    throw new ApiKeyError(`You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`, 409);
  }
  const key = newSecret("apiKey");
  const row = await db.apiKey.create({
    data: {
      name: input.name,
      displayPrefix: key.slice(0, SECRET_PREFIX.apiKey.length + 6),
      keyHash: hashSecret(key),
      address: input.address,
      scopes: formatScopes(input.scopes),
      expiresAt: input.expiresInDays === null ? null : new Date(now.getTime() + input.expiresInDays * DAY_MS),
    },
  });
  return { key, apiKey: view(row) };
}

export async function listApiKeys(address: string, now: Date = new Date()): Promise<ApiKeyView[]> {
  const rows = await db.apiKey.findMany({ where: activeWhere(address, now), orderBy: { createdAt: "desc" } });
  return rows.map(view);
}

/** Revokes one of the wallet's keys; false when it isn't theirs or is already gone. */
export async function revokeApiKey(address: string, id: string, now: Date = new Date()): Promise<boolean> {
  const { count } = await db.apiKey.updateMany({ where: { id, address, revokedAt: null }, data: { revokedAt: now } });
  return count === 1;
}
