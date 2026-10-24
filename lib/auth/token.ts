import { jwtVerify, SignJWT } from "jose";

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const ISSUER = "wallettwin";
const AUDIENCE = "wallettwin:session";

export interface Session {
  address: string;
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
  return new SignJWT({})
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
    return payload.sub ? { address: payload.sub } : null;
  } catch {
    return null;
  }
}
