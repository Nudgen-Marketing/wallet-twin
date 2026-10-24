import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Unguessable per-wallet token for Wrapped share links. Sharing is opt-in: only the
 * owner's /wrapped page reveals it, but anyone holding the link (incl. X's crawler)
 * can render the card.
 */
export function wrappedToken(address: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`wrapped:${address}`).digest("base64url").slice(0, 24);
}

export function isValidWrappedToken(address: string, token: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(wrappedToken(address));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function wrappedImagePath(address: string): string {
  return `/api/wrapped/og?a=${address}&t=${wrappedToken(address)}`;
}

export function wrappedSharePath(address: string): string {
  return `/w/${address}?t=${wrappedToken(address)}`;
}
