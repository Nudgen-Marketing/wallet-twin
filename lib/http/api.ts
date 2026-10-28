import { NextResponse, type NextRequest } from "next/server";

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, error: null }, init);
}

export function fail(error: string, status: number): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ success: false, data: null, error }, { status });
}

/**
 * CSRF guard for cookie-authenticated mutations: the browser always sends Origin on
 * cross-site POSTs, so reject any request whose Origin isn't this host. The host comes from
 * the request headers, as Server Actions do: behind a proxy the standalone server's own URL
 * is its bind address (0.0.0.0:3000), never the public host the browser used.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * The caller's IP as our reverse proxy saw it. The left end of X-Forwarded-For is whatever the
 * client sent, so rate limits key on X-Real-IP or the right-most hop the proxy appended.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
}

/** Parses a JSON body, returning null instead of throwing on malformed input. */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
