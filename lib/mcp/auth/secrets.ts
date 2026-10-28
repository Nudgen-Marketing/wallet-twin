import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Prefixed opaque secrets. Prefixes make leaked tokens easy to spot (and to add to secret
 * scanners); only SHA-256 hashes are ever stored, so a database leak exposes no usable token.
 */
export const SECRET_PREFIX = {
  access: "wt_at_",
  refresh: "wt_rt_",
  apiKey: "wt_key_",
  code: "wt_code_",
} as const;

export type SecretKind = keyof typeof SECRET_PREFIX;

export function newSecret(kind: SecretKind): string {
  return `${SECRET_PREFIX[kind]}${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function secretKind(secret: string): SecretKind | null {
  const entry = Object.entries(SECRET_PREFIX).find(([, prefix]) => secret.startsWith(prefix));
  return entry ? (entry[0] as SecretKind) : null;
}

/** RFC 7636 code_verifier: 43–128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/;
/** An S256 code_challenge is a base64url SHA-256: exactly 43 characters. */
export const S256_CHALLENGE = /^[A-Za-z0-9\-_]{43}$/;

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** PKCE S256 check (the only method we accept; "plain" is refused at /authorize). */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier) || !S256_CHALLENGE.test(challenge)) return false;
  const expected = Buffer.from(pkceChallenge(verifier));
  const given = Buffer.from(challenge);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
