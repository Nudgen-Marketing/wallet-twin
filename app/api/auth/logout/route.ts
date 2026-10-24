import type { NextRequest } from "next/server";
import { endSession } from "@/lib/auth/session";
import { fail, isSameOrigin, ok } from "@/lib/http/api";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return fail("Cross-site request blocked", 403);
  await endSession();
  return ok({ address: null });
}
