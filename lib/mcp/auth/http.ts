import "server-only";
import { CORS_HEADERS } from "@/lib/mcp/cors";
import { OAuthFlowError } from "@/lib/mcp/auth/oauth";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

/** OAuth endpoints take form-encoded bodies (RFC 6749); JSON is accepted too for lenient clients. */
export async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as unknown;
      if (!body || typeof body !== "object") return {};
      return Object.fromEntries(Object.entries(body).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
    return Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return {};
  }
}

export function oauthJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...NO_STORE } });
}

export function oauthError(error: unknown): Response {
  if (error instanceof OAuthFlowError) {
    return oauthJson({ error: error.code, error_description: error.message }, error.status);
  }
  console.error("[oauth] unexpected error", error instanceof Error ? error.message : error);
  return oauthJson({ error: "server_error", error_description: "Something went wrong. Try again." }, 500);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
