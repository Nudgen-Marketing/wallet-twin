import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { env } from "@/lib/env";
import {
  createSessionToken,
  readSessionToken,
  SESSION_TTL_SECONDS,
  type Session,
} from "@/lib/auth/token";

export type { Session } from "@/lib/auth/token";

const COOKIE_NAME = "wt_session";

/** Reads the signed-in wallet from the session cookie. Request-time only (wrap UI in <Suspense>). */
export async function getSession(): Promise<Session | null> {
  // Token expiry is checked against the current time, so this must never be prerendered.
  await connection();
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return readSessionToken(token, env().SESSION_SECRET);
}

/** Call from a Route Handler or Server Function only. */
export async function startSession(session: Session): Promise<void> {
  const token = await createSessionToken(session, env().SESSION_SECRET);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
