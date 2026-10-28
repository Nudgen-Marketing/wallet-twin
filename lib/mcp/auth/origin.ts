import "server-only";
import { headers } from "next/headers";
import { publicOrigin } from "@/lib/mcp/auth/urls";

/** The incoming request's headers as a Request, for helpers that read proxy headers. */
export async function pageRequest(): Promise<Request> {
  const requestHeaders = await headers();
  return new Request(`http://${requestHeaders.get("host") ?? "localhost"}/`, { headers: requestHeaders });
}

/** The public origin of the page being rendered (behind the proxy), for Server Components. */
export async function pageOrigin(): Promise<string> {
  return publicOrigin(await pageRequest());
}
