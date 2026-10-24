import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fail, isSameOrigin, ok, readJson } from "@/lib/http/api";
import { publishTwin, unpublishTwin } from "@/lib/twin/publish";

const bodySchema = z.object({ publish: z.boolean() });

/** Explicit opt-in/out of the public leaderboard and public chat for the signed-in twin. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  const session = await getSession();
  if (!session) return fail("Sign in to manage your twin.", 401);
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Malformed request.", 400);

  if (session.demo && !parsed.data.publish) return fail("Demo twins stay public so everyone can try them.", 403);

  if (parsed.data.publish) {
    const synced = await db.syncState.findUnique({ where: { address: session.address } });
    if (!synced) return fail("Sync your wallet before publishing your twin.", 409);
    await publishTwin(session.address);
  } else {
    await unpublishTwin(session.address);
  }
  return ok({ published: parsed.data.publish });
}
