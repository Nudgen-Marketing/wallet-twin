import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { setPublished, TwinActionError } from "@/lib/twin/actions";

const bodySchema = z.object({ publish: z.boolean() });

/** Explicit opt-in/out of the public leaderboard and public chat for the signed-in twin. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to manage your twin.", 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Malformed request.", 400);

  try {
    await setPublished(session, parsed.data.publish);
  } catch (error: unknown) {
    if (error instanceof TwinActionError) return fail(error.message, error.status);
    throw error;
  }
  return ok({ published: parsed.data.publish });
}
