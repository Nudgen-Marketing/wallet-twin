import { getSession } from "@/lib/auth/session";
import { ok } from "@/lib/http/api";

export async function GET() {
  const session = await getSession();
  return ok({ address: session?.address ?? null }, { headers: { "Cache-Control": "no-store" } });
}
