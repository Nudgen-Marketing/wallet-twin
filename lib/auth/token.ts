import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = "wallettwin";
const AUDIENCE = "wallettwin:session";

export interface Session {
  address: string;
  /** Shared demo login for a seeded wallet: read-mostly, never stores chat facts. */
  demo?: boolean;
}

function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  session: Session,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT(session.demo ? { demo: true } : {})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.address)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(keyFrom(secret));
}

/** Returns the session for a valid token, or null for anything expired, forged or malformed. */
export async function readSessionToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: now,
    });
    if (!payload.sub) return null;
    return payload.demo === true ? { address: payload.sub, demo: true } : { address: payload.sub };
  } catch {
    return null;
  }
}
