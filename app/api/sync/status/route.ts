import { getSession } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http/api";
import { getSyncStatus } from "@/lib/sync/status";

export async function GET() {
  const session = await getSession();
  if (!session) return fail("Sign in to see your sync.", 401);
  return ok(await getSyncStatus(session.address), { headers: { "Cache-Control": "no-store" } });
}
