import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/http/api";
import { createRateLimiter } from "@/lib/http/rate-limit";
import { ClientError, registerClient, registrationSchema } from "@/lib/mcp/auth/clients";
import { oauthJson, preflight } from "@/lib/mcp/auth/http";

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** RFC 7591 Dynamic Client Registration for public clients (2025-era MCP clients). */
export async function POST(request: NextRequest) {
  if (!limiter.take(clientIp(request))) return oauthJson({ error: "slow_down", error_description: "Too many registrations." }, 429);
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return oauthJson({ error: "invalid_client_metadata", error_description: "redirect_uris is required; only public clients are supported." }, 400);
  }
  try {
    const client = await registerClient(parsed.data);
    return oauthJson(
      {
        client_id: client.id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      201,
    );
  } catch (error: unknown) {
    if (error instanceof ClientError) return oauthJson({ error: "invalid_redirect_uri", error_description: error.message }, 400);
    throw error;
  }
}

export const OPTIONS = preflight;
