import { db } from "@/lib/db";
import { createApiKey } from "@/lib/mcp/auth/api-keys";
import { hashSecret, newSecret } from "@/lib/mcp/auth/secrets";
import { formatScopes, MCP_SCOPES, type McpScope } from "@/lib/mcp/scopes";
import { MCP_TEST_URL } from "@/tests/support/mcp";

export async function apiKeyFor(address: string, scopes: readonly McpScope[] = MCP_SCOPES): Promise<string> {
  const { key } = await createApiKey({ address, name: "test", scopes, expiresInDays: null });
  return key;
}

/** An OAuth grant + access token written straight to the DB (the OAuth flow has its own tests). */
export async function accessTokenFor(
  address: string,
  options: { scopes?: readonly McpScope[]; demo?: boolean; resource?: string } = {},
): Promise<{ token: string; grantId: string }> {
  const scopes = formatScopes(options.scopes ?? MCP_SCOPES);
  const grant = await db.oAuthGrant.create({
    data: { clientId: "test-client", clientName: "Test client", address, demo: options.demo ?? false, scopes },
  });
  const token = newSecret("access");
  await db.oAuthToken.create({
    data: {
      tokenHash: hashSecret(token),
      kind: "access",
      grantId: grant.id,
      scopes,
      resource: options.resource ?? MCP_TEST_URL,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return { token, grantId: grant.id };
}
